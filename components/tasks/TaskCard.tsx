import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useActions } from '@/components/sheets/ActionsProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, Chip } from '@/components/ui/Controls';
import { Txt } from '@/components/ui/Txt';
import { useJustFinished } from '@/lib/celebrate';
import { TASK_STATUS } from '@/lib/labels';
import { useTeam } from '@/lib/team';
import type { Task } from '@/lib/types';
import { EASE_SPRING, useMotion } from '@/theme/motion';
import { Confetti, DoneCheck, DoneNote, statusPop } from './DoneCelebration';

type Variant = 'card' | 'kanban' | 'row';

/** Görev kartı. 'card' telefon listesi, 'kanban' bilgisayar sütunu, 'row' proje detayı. */
export function TaskCard({ task, variant = 'card' }: { task: Task; variant?: Variant }) {
  const team = useTeam();
  const actions = useActions();
  const motion = useMotion();
  // Az önce bitirildiyse: onay kutusu dolar, durum "Bitti"ye dönüp pop yapar, konfeti ve teşekkür.
  const celebrating = useJustFinished().has(task.id) && task.status === 'bitti';

  const st = TASK_STATUS[task.status];
  const mine = task.assignee_id === team.meId;
  const pool = task.status === 'havuz';
  const pending = pool && team.pendingFor(task);
  const locked = pool && !team.canClaim(task);
  const project = task.project_id ? team.projectMap.get(task.project_id) : undefined;
  const who = pool ? 'Havuzda' : mine ? 'Sende' : team.nameOf(task.assignee_id);
  const assignee = team.person(task.assignee_id);

  const claimButton = pool && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: variant === 'kanban' ? 8 : 10, flexWrap: 'wrap' }}>
      <Button
        label={pending ? 'İstek gönderildi' : locked ? 'Kilitli' : 'Ben alırım'}
        kind={locked || pending ? 'muted' : 'primary'}
        bold
        size={variant === 'kanban' ? 'sm' : 'md'}
        icon={locked ? 'lock' : undefined}
        onPress={() => actions.claim(task)}
      />
      {locked && (
        <Txt size={variant === 'kanban' ? 12 : 12.5} color="muted" style={{ flexShrink: 1 }}>
          {team.lockHint(task)}
        </Txt>
      )}
    </View>
  );

  const chip = (
    <Animated.View
      key={celebrating ? 'bitti-pop' : task.status}
      style={
        celebrating && !motion.reduced
          ? { animationName: statusPop, animationDuration: 500, animationDelay: 200, animationTimingFunction: EASE_SPRING }
          : null
      }
    >
      <Chip label={st.label} bg={st.bg} fg={st.fg} />
    </Animated.View>
  );

  const share = () =>
    actions.openShare({ body: `${task.title} bitti! `, projectId: task.project_id, taskId: task.id });

  const myButtons = mine && task.status !== 'bitti' && (
    <View style={{ flexDirection: 'row', gap: variant === 'kanban' ? 6 : 8, flexWrap: 'wrap' }}>
      {st.next && (
        <Button
          label={variant === 'kanban' ? `${st.next} →` : st.next}
          iconRight={variant === 'kanban' ? undefined : 'arrow'}
          size={variant === 'kanban' ? 'sm' : 'md'}
          onPress={() => actions.advance(task)}
        />
      )}
      <Button
        label={task.needs_help ? 'Çözüldü' : 'Takıldım'}
        kind="soft"
        size={variant === 'kanban' ? 'sm' : 'md'}
        onPress={() => actions.toggleHelp(task)}
      />
    </View>
  );

  if (variant === 'row') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={600}>{task.title}</Txt>
          <Txt size={13} color="muted">
            {who} · {task.due_label}
          </Txt>
        </View>
        <Chip label={st.label} bg={st.bg} fg={st.fg} />
      </View>
    );
  }

  if (variant === 'kanban') {
    return (
      <Card radius={16} padding={14} gap={8}>
        {celebrating && <Confetti />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={12} weight={600} color={project ? 'accent-text' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
            {project?.name ?? 'Projesiz'}
          </Txt>
          {celebrating && chip}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          {celebrating && <DoneCheck size={22} />}
          <Txt weight={600} style={{ flex: 1 }}>
            {task.title}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {assignee ? (
            <Avatar person={assignee} size={22} />
          ) : (
            <Box bg="chip" style={{ width: 22, height: 22, borderRadius: 11 }} />
          )}
          <Txt size={12.5} color="muted" style={{ flex: 1 }} numberOfLines={1}>
            {who}
          </Txt>
          <Txt size={12.5} color="muted">
            {task.due_label}
          </Txt>
        </View>
        {task.needs_help && (
          <Txt size={12.5} weight={600} color="warn-text">
            Yardım istiyor
          </Txt>
        )}
        {claimButton}
        {myButtons}
        {celebrating && <DoneNote onShare={share} />}
      </Card>
    );
  }

  return (
    <Card radius={24} gap={10}>
      {celebrating && <Confetti />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={12.5} weight={600} color={project ? 'accent-text' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
          {project?.name ?? 'Projesiz'}
        </Txt>
        {chip}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {celebrating && <DoneCheck />}
        <Txt size={17} weight={600} leading={1.3} style={{ flex: 1 }}>
          {task.title}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt size={13} color="muted">
          {who} · {task.due_label}
        </Txt>
        {task.needs_help && (
          <Txt size={13} weight={600} color="warn-text">
            · Yardım istiyor
          </Txt>
        )}
      </View>
      {claimButton}
      {myButtons}
      {celebrating && <DoneNote onShare={share} />}
    </Card>
  );
}
