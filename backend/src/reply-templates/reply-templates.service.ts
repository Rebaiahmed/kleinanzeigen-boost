import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ReplyTemplate {
  id?: string;
  icon: string;
  title: string;
  content: string;
  copyCount: number;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class ReplyTemplatesService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(ReplyTemplatesService.name);

  constructor(private readonly firebaseService: FirebaseService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
  }

  private getCollection(userId: string) {
    return this.firebaseService.firestore.collection(`users/${userId}/replyTemplates`);
  }

  async getTemplates(userId: string): Promise<ReplyTemplate[]> {
    const snapshot = await this.getCollection(userId).get();
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ReplyTemplate[];
  }

  async createTemplate(userId: string, data: Partial<ReplyTemplate>): Promise<ReplyTemplate> {
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
    
    if (!doc.exists) {
      throw new NotFoundException('Template not found');
    }

    const updates = {
      ...data,
      updatedAt: Date.now(),
    };
    delete updates.id; // Prevent overwriting ID

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
      const currentCount = doc.data().copyCount || 0;
      await docRef.update({ copyCount: currentCount + 1, updatedAt: Date.now() });
    }
  }

  async saveGeneratedTemplates(userId: string, templates: Partial<ReplyTemplate>[]): Promise<ReplyTemplate[]> {
    const results: ReplyTemplate[] = [];
    for (const t of templates) {
      results.push(await this.createTemplate(userId, t));
    }
    return results;
  }

  async generateTemplatesFromAd(userId: string, adData: { title: string, description: string, price: string, category: string }): Promise<Partial<ReplyTemplate>[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      const isFree = adData.price?.toLowerCase().includes('verschenken') || adData.price === '0' || adData.price === 'Zu verschenken';
      const isClothing = adData.category?.toLowerCase().includes('kleidung') || adData.category?.toLowerCase().includes('mode');

      const prompt = `
Du bist ein Assistent für eBay Kleinanzeigen Verkäufer.
Erstelle 5 kurze, freundliche und direkt kopierbare Antwort-Vorlagen für folgende Anzeige.

Titel: ${adData.title}
Preis: ${adData.price}
Kategorie: ${adData.category}
Beschreibung: ${adData.description}

Die 5 Vorlagen MÜSSEN diese Themen abdecken:
1. Verfügbarkeit (Zusage, dass der Artikel noch da ist)
2. Versand (Ob Versand möglich ist oder Abholung)
3. Preis (Preisverhandlung. ${isFree ? 'Da es kostenlos ist, weise darauf hin, dass es nur bei echtem Interesse abzuholen ist.' : 'Bleibe beim Preis freundlich aber bestimmt.'})
4. Details (${isClothing ? 'Erwähne Größe, Farbe und Zustand.' : 'Erwähne die wichtigsten Details oder den Zustand des Artikels.'})
5. Abholung (Vereinbarung zur Abholung)

Gib das Ergebnis EXAKT im folgenden JSON-Format zurück, ohne Markdown, ohne zusätzliche Erklärungen:
[
  { "icon": "📦", "title": "Verfügbarkeit", "content": "..." },
  { "icon": "📮", "title": "Versand", "content": "..." },
  { "icon": "💰", "title": "Preis", "content": "..." },
  { "icon": "📏", "title": "Details", "content": "..." },
  { "icon": "🚚", "title": "Abholung", "content": "..." }
]
`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      
      // Clean up markdown if Gemini wrapped it in ```json
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
      } else if (text.startsWith('\`\`\`')) {
        text = text.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
      }

      const parsed = JSON.parse(text);
      return parsed as Partial<ReplyTemplate>[];
    } catch (e: any) {
      this.logger.error('Error generating templates: ' + e.message);
      throw new InternalServerErrorException('Failed to generate templates via AI.');
    }
  }
}
