import { useLocalSearchParams } from 'expo-router';

import { ChatRoom } from '@/components/chat/ChatRoom';

export default function SohbetOdasi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatRoom key={id} roomId={id} />;
}
