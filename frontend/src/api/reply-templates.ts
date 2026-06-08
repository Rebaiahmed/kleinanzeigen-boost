const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export interface ReplyTemplate {
  id?: string;
  icon: string;
  title: string;
  content: string;
  copyCount: number;
  createdAt?: number;
  updatedAt?: number;
}

export const ReplyTemplatesApi = {
  async getAll(): Promise<ReplyTemplate[]> {
    const res = await fetch(`${API_URL}/reply-templates`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  async create(data: Partial<ReplyTemplate>): Promise<ReplyTemplate> {
    const res = await fetch(`${API_URL}/reply-templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || 'Failed to create template');
    }
    return res.json();
  },

  async update(id: string, data: Partial<ReplyTemplate>): Promise<ReplyTemplate> {
    const res = await fetch(`${API_URL}/reply-templates/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update template');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/reply-templates/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete template');
  },

  async copy(id: string): Promise<void> {
    await fetch(`${API_URL}/reply-templates/${id}/copy`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async generate(context?: string, topics?: string[]): Promise<Partial<ReplyTemplate>[]> {
    const res = await fetch(`${API_URL}/reply-templates/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ context, topics }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || 'KI-Generierung fehlgeschlagen');
    }
    return res.json();
  },

  async saveGenerated(templates: Partial<ReplyTemplate>[]): Promise<ReplyTemplate[]> {
    const res = await fetch(`${API_URL}/reply-templates/save-generated`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ templates }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || 'Speichern fehlgeschlagen');
    }
    return res.json();
  }
};
