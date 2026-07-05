import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

export enum NoteTag {
  FINDING = 'finding',
  HYPOTHESIS = 'hypothesis',
  ACTION_ITEM = 'action_item',
  HANDOFF = 'handoff',
}

/**
 * Per-case chat/notes. `body` is stored as plain markdown source — never HTML —
 * so there's nothing to sanitize at rest; rendering sanitizes on the way out
 * (see frontend ChatPanel). No link or image tags survive rendering, by design:
 * no external egress, no third-party embeds.
 */
@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  case: Case;

  @ManyToOne(() => User)
  author: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  tag: NoteTag | null;

  @CreateDateColumn()
  ts: Date;
}
