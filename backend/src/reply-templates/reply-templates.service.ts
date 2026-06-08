import { Injectable, InternalServerErrorException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
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
  { icon: '📦', key: 'Verfügbarkeit', instruction: 'bestätigen dass der Artikel noch verfügbar ist' },
  { icon: '📮', key: 'Versand',       instruction: 'ob Versand möglich ist und wer die Kosten trägt' },
  { icon: '💰', key: 'Preis',         instruction: 'freundlich aber bestimmt beim Preis bleiben' },
  { icon: '📏', key: 'Details',       instruction: 'wichtigste Details oder Zustand des Artikels nennen' },
  { icon: '🚚', key: 'Abholung',      instruction: 'Abholtermin vereinbaren' },
];

const buildPrompt = (context?: string, topics?: string[]) => {
  const activeTopic = topics?.length ? TOPICS.filter(t => topics.includes(t.key)) : TOPICS;
  const hint = context?.trim()
    ? `Der Verkäufer verkauft: ${context.trim()}.`
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
    if (plan === 'free') {
      const snapshot = await this.getCollection(userId).count().get();
      if (snapshot.data().count >= 3) {
        throw new ForbiddenException({
          message: 'Kostenloses Limit erreicht (3 Vorlagen). Upgrade auf Pro für unbegrenzte Vorlagen.',
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
    if (plan === 'free') {
      const snapshot = await this.getCollection(userId).count().get();
      const existing = snapshot.data().count as number;
      const available = Math.max(0, 3 - existing);
      if (available === 0) {
        throw new ForbiddenException({
          message: 'Kostenloses Limit erreicht (3 Vorlagen). Upgrade auf Pro für unbegrenzte Vorlagen.',
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
    body: { context?: string; topics?: string[] },
  ): Promise<Partial<ReplyTemplate>[]> {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      throw new InternalServerErrorException('KI nicht konfiguriert.');
    }

    const prompt = buildPrompt(body.context, body.topics);

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemma-4-31b-it:free',
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
      const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      this.logger.error(`Template generation failed: ${detail}`);
      throw new InternalServerErrorException(
        `KI-Generierung fehlgeschlagen: ${e.response?.data?.error?.message || e.message}`,
      );
    }
  }

  private parseTemplatesJson(text: string): Partial<ReplyTemplate>[] {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in AI response: ${cleaned.slice(0, 150)}`);
    return JSON.parse(match[0]) as Partial<ReplyTemplate>[];
  }
}
