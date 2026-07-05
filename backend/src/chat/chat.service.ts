import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CasesService, RequestUser } from '../cases/cases.service';
import { ChatMessage, User } from '../entities';
import { ChatGateway } from './chat.gateway';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly casesService: CasesService,
    private readonly auditService: AuditService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async findForCase(caseId: number, actor: RequestUser): Promise<ChatMessage[]> {
    await this.casesService.findOneScoped(caseId, actor);
    return this.messages.find({
      where: { case: { id: caseId } },
      relations: ['author'],
      order: { ts: 'ASC' },
    });
  }

  async postMessage(caseId: number, dto: CreateMessageDto, actor: RequestUser): Promise<ChatMessage> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const author = await this.users.findOneOrFail({ where: { id: actor.userId } });

    const saved = await this.messages.save(
      this.messages.create({ case: kase, author, body: dto.body, tag: dto.tag ?? null }),
    );
    this.chatGateway.broadcastMessage(caseId, saved);
    return saved;
  }

  /** Plain-text transcript. The export itself is an audited action, per the security note in the plan. */
  async exportTranscript(caseId: number, actor: RequestUser): Promise<string> {
    const kase = await this.casesService.findOneScoped(caseId, actor);
    const messages = await this.findForCase(caseId, actor);
    const actorEntity = await this.users.findOneOrFail({ where: { id: actor.userId } });

    await this.auditService.record({
      case: kase,
      actor: actorEntity,
      field: 'chat_export',
      oldValue: null,
      newValue: `${messages.length} message(s) exported`,
    });

    const lines = messages.map((m) => {
      const tag = m.tag ? ` [${m.tag}]` : '';
      return `[${m.ts.toISOString()}] ${m.author.name}${tag}: ${m.body}`;
    });
    return lines.join('\n');
  }
}
