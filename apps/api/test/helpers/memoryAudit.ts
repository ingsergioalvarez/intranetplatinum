import { AuditLogger, type AuditEvent } from '../../src/core';

/** Auditoría en memoria para pruebas. */
export class MemoryAuditLogger extends AuditLogger {
  eventos: AuditEvent[] = [];
  protected async guardar(evento: AuditEvent) {
    this.eventos.push(evento);
  }
  acciones() {
    return this.eventos.map((e) => e.accion);
  }
}
