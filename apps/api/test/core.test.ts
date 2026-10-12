import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { idParamSchema, paginationQuerySchema, type Paginated, type PaginationQuery } from '@platinum/shared';
import { createApp } from '../src/app';
import { healthModule } from '../src/modules/health';
import {
  BaseController,
  BaseRepository,
  CrudService,
  authenticate,
  requireRoles,
  signAccessToken,
  uploadImages,
  validate,
  type AppModule,
  type AuthUser,
} from '../src/core';

// ---------- Módulo de ejemplo que usa todas las clases base ----------
interface Nota {
  id: number;
  texto: string;
  activo: boolean;
}
type NotaCreate = { texto: string };

class NotaMemoryRepository extends BaseRepository<Nota, NotaCreate, Partial<NotaCreate>> {
  private data: Nota[] = [];
  async findById(id: number) {
    return this.data.find((n) => n.id === id && n.activo) ?? null;
  }
  async findPaged(_f: Record<string, unknown>, { page, limit }: PaginationQuery): Promise<Paginated<Nota>> {
    const activos = this.data.filter((n) => n.activo);
    return { items: activos.slice((page - 1) * limit, page * limit), total: activos.length, page, limit };
  }
  async create(data: NotaCreate) {
    const nota = { id: this.data.length + 1, activo: true, ...data };
    this.data.push(nota);
    return nota;
  }
  async update(id: number, data: Partial<NotaCreate>) {
    const nota = this.data.find((n) => n.id === id)!;
    Object.assign(nota, data);
    return nota;
  }
  async softDelete(id: number) {
    this.data.find((n) => n.id === id)!.activo = false;
  }
  async restore(id: number) {
    this.data.find((n) => n.id === id)!.activo = true;
  }
}

class NotaService extends CrudService<Nota, NotaCreate, Partial<NotaCreate>> {
  protected readonly entityLabel = 'Nota';
}

class NotaController extends BaseController {
  constructor(private readonly service: NotaService) {
    super();
  }
  list = async (req: Request, res: Response) =>
    this.paginated(res, await this.service.list({}, this.query<PaginationQuery>(req)));
  get = async (req: Request, res: Response) =>
    this.ok(res, await this.service.getById(this.params<{ id: number }>(req).id));
  create = async (req: Request, res: Response) =>
    this.created(res, await this.service.create(this.body<NotaCreate>(req)));
  remove = async (req: Request, res: Response) => {
    await this.service.deactivate(this.params<{ id: number }>(req).id);
    return this.noContent(res);
  };
  upload = (req: Request, res: Response) =>
    this.ok(res, { archivos: (req.files as Express.Multer.File[]).length });
}

const ctrl = new NotaController(new NotaService(new NotaMemoryRepository()));
const router = Router();
router.use(authenticate);
router.get('/', validate({ query: paginationQuerySchema }), ctrl.list);
router.get('/:id', validate({ params: idParamSchema }), ctrl.get);
router.post(
  '/',
  requireRoles('admin', 'supervisor'),
  validate({ body: z.object({ texto: z.string().min(3) }) }),
  ctrl.create,
);
router.delete('/:id', requireRoles('admin'), validate({ params: idParamSchema }), ctrl.remove);
router.post('/fotos', uploadImages.array('fotos', 3), ctrl.upload);

const notasModule: AppModule = { name: 'notas', basePath: 'notas', router };
const app = createApp([healthModule, notasModule]);

const user = (rol: AuthUser['rol']): AuthUser => ({ id: 1, email: `${rol}@platinum.mx`, rol, permisos: [] });
const bearer = (rol: AuthUser['rol']) => `Bearer ${signAccessToken(user(rol))}`;

// ---------- Pruebas ----------
describe('core del API', () => {
  it('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('ruta inexistente → 404 con formato estándar', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('sin token → 401; token inválido → 401 TOKEN_INVALID', async () => {
    expect((await request(app).get('/api/health/me')).status).toBe(401);
    const res = await request(app).get('/api/health/me').set('Authorization', 'Bearer basura');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('token válido → devuelve el usuario', async () => {
    const res = await request(app).get('/api/health/me').set('Authorization', bearer('guardia'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, rol: 'guardia' });
  });

  it('rol no permitido → 403', async () => {
    const res = await request(app)
      .post('/api/notas')
      .set('Authorization', bearer('guardia'))
      .send({ texto: 'hola' });
    expect(res.status).toBe(403);
  });

  it('validación zod → 400 VALIDATION_ERROR con detalles', async () => {
    const res = await request(app)
      .post('/api/notas')
      .set('Authorization', bearer('admin'))
      .send({ texto: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('texto');
  });

  it('CRUD genérico: crear, paginar, obtener, baja lógica', async () => {
    const auth = bearer('admin');
    const creado = await request(app)
      .post('/api/notas')
      .set('Authorization', auth)
      .send({ texto: 'Lámpara fundida' });
    expect(creado.status).toBe(201);
    const id = creado.body.data.id;

    const lista = await request(app).get('/api/notas?page=1&limit=5').set('Authorization', auth);
    expect(lista.body.data).toMatchObject({ total: 1, page: 1, limit: 5 });

    expect((await request(app).get(`/api/notas/${id}`).set('Authorization', auth)).status).toBe(200);
    expect((await request(app).delete(`/api/notas/${id}`).set('Authorization', auth)).status).toBe(204);

    const borrado = await request(app).get(`/api/notas/${id}`).set('Authorization', auth);
    expect(borrado.status).toBe(404);
    expect(borrado.body.error.message).toBe('Nota no encontrado');
  });

  it('upload: acepta imágenes y rechaza otros tipos', async () => {
    const auth = bearer('guardia');
    const ok = await request(app)
      .post('/api/notas/fotos')
      .set('Authorization', auth)
      .attach('fotos', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.archivos).toBe(1);

    const ko = await request(app)
      .post('/api/notas/fotos')
      .set('Authorization', auth)
      .attach('fotos', Buffer.from('hola'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(ko.status).toBe(400);
    expect(ko.body.error.code).toBe('UPLOAD_ERROR');
  });

  it('JSON mal formado → 400', async () => {
    const res = await request(app)
      .post('/api/notas')
      .set('Authorization', bearer('admin'))
      .set('Content-Type', 'application/json')
      .send('{"texto":');
    expect(res.status).toBe(400);
  });
});
