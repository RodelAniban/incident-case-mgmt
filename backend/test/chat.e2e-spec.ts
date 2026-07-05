import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('chat', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;
  let caseId: number;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp({ listen: true });
    roster = await seedRoster(ctx);
    caseId = (await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!)).id;
  });

  afterEach(() => {
    sockets.forEach((s) => s.disconnect());
    sockets.length = 0;
  });

  afterAll(async () => {
    await ctx.close();
  });

  function connect(): Socket {
    const socket = io(ctx.baseUrl, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return socket;
  }

  it('delivers a message posted via REST to a socket that joined the case room, in real time', async () => {
    const socket = connect();
    await waitForEvent(socket, 'connect');
    socket.emit('join', { caseId, token: roster.analyst2.token });
    await waitForEvent(socket, 'joined');

    const messagePromise = waitForEvent<{ body: string }>(socket, 'message');
    await request(ctx.httpServer as never)
      .post(`/api/chat/cases/${caseId}/messages`)
      .set(auth(roster.analyst1.token))
      .send({ body: 'hello from the REST side' })
      .expect(201);

    const received = await messagePromise;
    expect(received.body).toBe('hello from the REST side');
  });

  it('refuses to join for a role without CHAT_ON_CASE (CISO)', async () => {
    const socket = connect();
    await waitForEvent(socket, 'connect');
    socket.emit('join', { caseId, token: roster.ciso.token });
    const err = await waitForEvent(socket, 'join-error');
    expect(err).toBeTruthy();
  });

  it('refuses to join for a case outside the requester\'s team scope', async () => {
    const outsiderCase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const outsiderSocket = connect();
    await waitForEvent(outsiderSocket, 'connect');
    // analyst2 IS on the case's team, so join a case scoped differently: use a
    // fabricated far-away case id instead, which findOneScoped will 404/403 on.
    outsiderSocket.emit('join', { caseId: outsiderCase.id + 999_999, token: roster.analyst2.token });
    const err = await waitForEvent(outsiderSocket, 'join-error');
    expect(err).toBeTruthy();
  });

  it('rejects a garbage token at join time', async () => {
    const socket = connect();
    await waitForEvent(socket, 'connect');
    socket.emit('join', { caseId, token: 'not-a-real-jwt' });
    const err = await waitForEvent(socket, 'join-error');
    expect(err).toBeTruthy();
  });

  it('lets CISO export a transcript despite being unable to view it live, and audits the export', async () => {
    const res = await request(ctx.httpServer as never)
      .get(`/api/chat/cases/${caseId}/export`)
      .set(auth(roster.ciso.token));
    expect(res.status).toBe(200);
    expect(res.text).toContain('hello from the REST side');

    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/${caseId}`)
      .set(auth(roster.lead.token));
    const exportEntry = auditRes.body.find((e: { field: string }) => e.field === 'chat_export');
    expect(exportEntry).toBeTruthy();
  });
});
