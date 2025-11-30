export interface Category {
  id: string;
  name: string;
  color: string; // Tailwind class like 'bg-red-500'
  icon: string; // Lucide icon name
  isPublic?: boolean; // true = admin published, visible to all users
  ownerId?: string; // userId who created this (for private) or admin who published (for public)
}

export interface Note {
  id: string;
  categoryId: string;
  title: string;
  content: string; // Markdown supported
  imageUrl?: string; // Base64 or URL (legacy single image)
  images?: string[]; // Array of Base64 or URLs for multiple images
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  isPublic?: boolean; // true = admin published, visible to all users
  ownerId?: string; // userId who created this
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  createdAt: number;
}

export type ViewState = 'DASHBOARD' | 'CATEGORY_DETAIL' | 'NOTE_EDITOR' | 'NOTE_VIEWER' | 'CATEGORY_EDITOR' | 'SETTINGS';

export interface AIResponse {
  title?: string;
  content: string;
  tags?: string[];
}