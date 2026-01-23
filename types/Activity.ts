
export interface Activity {
  id: string;
  title: string;
  description: string;
  image: string;
  host: {
    id: string;
    name: string;
    avatar: string;
  };
  date: string;
  time: string;
  location: string;
  city: string;
  capacity: number;
  participants: Participant[];
  category: string;
  distance?: string;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
}

export interface User {
  id: string;
  name: string;
  bio: string;
  city: string;
  interests: string[];
  avatar: string;
  email?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  image?: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  name: string;
  image: string;
  lastMessage: string;
  lastMessageTime: string;
  isGroup: boolean;
  activityId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}
