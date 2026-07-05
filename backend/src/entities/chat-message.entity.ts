import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Case } from './case.entity';
import { User } from './user.entity';

/** Phase 3 (Secure Analyst Chat & Notes) — schema reserved now, delivery ships later. */
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

  @Column({ nullable: true })
  tag: string;

  @CreateDateColumn()
  ts: Date;
}
