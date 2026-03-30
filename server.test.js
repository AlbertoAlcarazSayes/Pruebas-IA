'use strict';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// Use an in-memory (temp) database for tests
process.env.DB_PATH = path.join(require('os').tmpdir(), `tasks-test-${Date.now()}.db`);

const { app, db } = require('./server');

afterAll(() => {
  db.close();
  try { fs.unlinkSync(process.env.DB_PATH); } catch (_) {}
});

describe('GET /api/tasks', () => {
  it('returns an empty array initially', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with title only', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test task' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test task');
    expect(res.body.description).toBe('');
    expect(res.body.completed).toBe(false);
    expect(res.body.id).toBeDefined();
  });

  it('creates a task with title and description', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Task 2', description: 'Some details' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Some details');
  });

  it('rejects a task without a title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ description: 'No title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects a blank title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Fetch me', description: 'detail' });
    createdId = res.body.id;
  });

  it('returns the task by id', async () => {
    const res = await request(app).get(`/api/tasks/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Fetch me');
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app).get('/api/tasks/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tasks/:id', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Update me' });
    taskId = res.body.id;
  });

  it('updates title and marks completed', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ title: 'Updated title', completed: true });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(res.body.completed).toBe(true);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app)
      .put('/api/tasks/999999')
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects an empty title on update', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Delete me' });
    taskId = res.body.id;
  });

  it('deletes an existing task and returns 204', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 when deleting a non-existent task', async () => {
    const res = await request(app).delete('/api/tasks/999999');
    expect(res.status).toBe(404);
  });

  it('task is no longer retrievable after deletion', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });
});
