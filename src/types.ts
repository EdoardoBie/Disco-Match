export type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  created_at: string;
  last_seen: string;
};

export type Question = {
  id: string;
  text: string;
  type: 'text' | 'choice' | 'photo';
  options?: string[]; // Stored as jsonb in DB
  is_active: boolean;
  created_at: string;
};

export type Answer = {
  id: string;
  user_id: string;
  question_id: string;
  answer_text: string; // Changed from answer_data to answer_text based on schema
  created_at: string;
};

export type Match = {
  id: string;
  user1_id: string;
  user2_id: string;
  score: number;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};
