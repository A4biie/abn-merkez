import { useLocalSearchParams } from 'expo-router';

import { BoardList } from '@/components/board/BoardList';
import { BoardView } from '@/components/board/BoardView';

/** Panolar sekmesi önce listeyi açar; ?pano=<id> ile panonun içi açılır. */
export default function Panolar() {
  const { pano } = useLocalSearchParams<{ pano?: string }>();
  return pano ? <BoardView boardId={pano} /> : <BoardList />;
}
