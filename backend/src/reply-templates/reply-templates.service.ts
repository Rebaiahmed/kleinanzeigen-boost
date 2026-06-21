import { Injectable, InternalServerErrorException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { FREE_TEMPLATE_LIMIT, MONETIZATION_ENABLED } from '../config/ai-limits.constants';
import axios from 'axios';

export interface ReplyTemplate {
  id?: string;
  icon: string;
  title: string;
  content: string;
  copyCount: number;
  createdAt: number;
  updatedAt: number;
}

const TOPICS = [
  { icon: '📦', key: 'Verfügbarkeit', en: 'Availability', instruction: 'bestätigen dass der Artikel noch verfügbar ist', instructionEn: 'confirm the item is still available' },
  { icon: '📮', key: 'Versand',       en: 'Shipping',     instruction: 'ob Versand möglich ist und wer die Kosten trägt', instructionEn: 'whether shipping is possible and who pays' },
  { icon: '💰', key: 'Preis',         en: 'Price',        instruction: 'freundlich aber bestimmt beim Preis bleiben', instructionEn: 'stay friendly but firm on the price' },
  { icon: '📏', key: 'Details',       en: 'Details',      instruction: 'wichtigste Details oder Zustand des Artikels nennen', instructionEn: 'state the key details or condition of the item' },
  { icon: '🚚', key: 'Abholung',      en: 'Pickup',       instruction: 'Abholtermin vereinbaren', instructionEn: 'arrange a pickup time' },
];

/** Max characters of free-text context accepted from the user (token-waste guard). */
const MAX_CONTEXT_CHARS = 200;

const buildPrompt = (context?: string, topics?: string[], language?: string) => {
  const isEn = (language || 'de').toLowerCase().startsWith('en');
  const filtered = topics?.length ? TOPICS.filter(t => topics.includes(t.key)) : TOPICS;
  const activeTopic = filtered.length ? filtered : TOPICS; // never empty
  const trimmedContext = context?.trim().slice(0, MAX_CONTEXT_CHARS);

  if (isEn) {
    const hint = trimmedContext
      ? `The seller is selling: ${trimmedContext}.`
      : 'The seller sells various items on a classifieds marketplace.';
    const topicList = activeTopic.map((t, i) => `${i + 1}. ${t.en} – ${t.instructionEn}`).join('\n');
    const exampleEntry = `{"icon":"${activeTopic[0].icon}","title":"${activeTopic[0].en}","content":"..."}`;
    return `You are an assistant for classifieds sellers. ${hint}

Create exactly ${activeTopic.length} short, friendly, ready-to-copy reply templates in ENGLISH.

The templates MUST cover these topics:
${topicList}

Reply ONLY with a JSON array, no markdown or explanations. Example format:
[${exampleEntry}]`;
  }

  const hint = trimmedContext
    ? `Der Verkäufer verkauft: ${trimmedContext}.`
    : 'Der Verkäufer verkauft verschiedene Artikel auf Kleinanzeigen.';
  const topicList = activeTopic.map((t, i) => `${i + 1}. ${t.key} – ${t.instruction}`).join('\n');
  const exampleEntry = `{"icon":"${activeTopic[0].icon}","title":"${activeTopic[0].key}","content":"..."}`;

  return `Du bist ein Assistent für Kleinanzeigen-Verkäufer in Deutschland. ${hint}

Erstelle genau ${activeTopic.length} kurze, freundliche und direkt kopierbare Antwort-Vorlagen auf Deutsch.

Die Vorlagen MÜSSEN diese Themen abdecken:
${topicList}

Antworte NUR mit einem JSON-Array ohne Markdown oder Erklärungen. Beispiel-Format:
[${exampleEntry}]`;
};

@Injectable()
export class ReplyTemplatesService {
  private readonly logger = new Logger(ReplyTemplatesService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  private getCollection(userId: string) {
    return this.firebaseService.firestore.collection(`users/${userId}/replyTemplates`);
  }

  async getTemplates(userId: string): Promise<ReplyTemplate[]> {
    const snapshot = await this.getCollection(userId).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ReplyTemplate[];
  }

  async createTemplate(userId: string, data: Partial<ReplyTemplate>): Promise<ReplyTemplate> {
    const userDoc = await this.firebaseService.firestore.collection('users').doc(userId).get();
    const plan = (userDoc.data()?.tier || userDoc.data()?.plan || 'free').toLowerCase();
    if (MONETIZATION_ENABLED && plan === 'free') {
      const snapshot = await this.getCollection(userId).count().get();
      if (snapshot.data().count >= FREE_TEMPLATE_LIMIT) {
        throw new ForbiddenException({
          message: `Kostenloses Limit erreicht (${FREE_TEMPLATE_LIMIT} Vorlagen). Upgrade auf Pro für unbegrenzte Vorlagen.`,
          code: 'TEMPLATE_LIMIT_REACHED',
        });
      }
    }

    const docRef = this.getCollection(userId).doc();
    const newTemplate: ReplyTemplate = {
      icon: data.icon || '💬',
      title: data.title || 'Neue Vorlage',
      content: data.content || '',
      copyCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await docRef.set(newTemplate);
    return { id: docRef.id, ...newTemplate };
  }

  async updateTemplate(userId: string, templateId: string, data: Partial<ReplyTemplate>): Promise<ReplyTemplate> {
    const docRef = this.getCollection(userId).doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Template not found');

    const updates = { ...data, updatedAt: Date.now() };
    delete updates.id;
    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as ReplyTemplate;
  }

  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    await this.getCollection(userId).doc(templateId).delete();
    this.logger.log(`Template deleted — user=${userId} template=${templateId}`);
  }

  async incrementCopyCount(userId: string, templateId: string): Promise<void> {
    const docRef = this.getCollection(userId).doc(templateId);
    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({ copyCount: (doc.data().copyCount || 0) + 1, updatedAt: Date.now() });
    }
  }

  async saveGeneratedTemplates(userId: string, templates: Partial<ReplyTemplate>[]): Promise<ReplyTemplate[]> {
    const userDoc = await this.firebaseService.firestore.collection('users').doc(userId).get();
    const plan = (userDoc.data()?.tier || userDoc.data()?.plan || 'free').toLowerCase();

    let toSave = templates;
    if (MONETIZATION_ENABLED && plan === 'free') {
      const snapshot = await this.getCollection(userId).count().get();
      const existing = snapshot.data().count as number;
      const available = Math.max(0, FREE_TEMPLATE_LIMIT - existing);
      if (available === 0) {
        throw new ForbiddenException({
          message: `Kostenloses Limit erreicht (${FREE_TEMPLATE_LIMIT} Vorlagen). Upgrade auf Pro für unbegrenzte Vorlagen.`,
          code: 'TEMPLATE_LIMIT_REACHED',
        });
      }
      toSave = templates.slice(0, available);
    }

    const results: ReplyTemplate[] = [];
    for (const t of toSave) {
      const docRef = this.getCollection(userId).doc();
      const newTemplate: ReplyTemplate = {
        icon: t.icon || '💬',
        title: t.title || 'Neue Vorlage',
        content: t.content || '',
        copyCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await docRef.set(newTemplate);
      results.push({ id: docRef.id, ...newTemplate });
    }
    return results;
  }

  async generateTemplates(
    userId: string,
    body: { context?: string; topics?: string[]; language?: string },
  ): Promise<Partial<ReplyTemplate>[]> {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      throw new InternalServerErrorException('KI nicht konfiguriert.');
    }

    const prompt = buildPrompt(body.context, body.topics, body.language);

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          // Was google/gemma-4-31b-it:free, which is constantly rate-limited (429)
          // on OpenRouter's free tier → template generation silently failed. Use the
          // cheap, reliable paid model (fractions of a cent per call).
          model: 'google/gemini-2.5-flash-lite',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://kleinanzeigen-boost.web.app',
          },
          timeout: 30000,
        },
      );

      const text: string = response.data.choices?.[0]?.message?.content?.trim() || '';
      if (!text) throw new Error('Empty response from AI model');

      return this.parseTemplatesJson(text);
    } catch (e: any) {
      // Log the real detail server-side; never leak raw model output / parse
      // errors / provider payloads to the client.
      const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      this.logger.error(`Template generation failed: ${detail}`);
      throw new InternalServerErrorException(
        'Die KI-Vorlagen konnten nicht erstellt werden. Bitte versuche es in Kürze erneut.',
      );
    }
  }

  private parseTemplatesJson(text: string): Partial<ReplyTemplate>[] {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error(`No JSON array found in AI response. Raw start: ${cleaned.slice(0, 150)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch (err: any) {
      throw new Error(`Malformed JSON from AI: ${err.message}. Raw: ${match[0].slice(0, 150)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('AI response JSON was not an array of templates.');
    }
    return parsed as Partial<ReplyTemplate>[];
  }
}
