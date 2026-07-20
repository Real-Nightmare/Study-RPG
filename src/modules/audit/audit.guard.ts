import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: string;
  targetType: string;
  idParam?: string;
}

/**
 * Decorator that marks a controller method for automatic audit logging.
 * After the handler succeeds, an entry is written to the audit_logs table.
 */
export const Audit = (action: string, targetType: string, idParam?: string): MethodDecorator =>
  SetMetadata(AUDIT_KEY, { action, targetType, idParam });

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta || !this.auditService) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const actor = (user?.username || user?.email || user?.sub || 'anonymous') as string;

    const targetId = meta.idParam ? (request.params?.[meta.idParam] ?? '') : '';

    return next.handle().pipe(
      tap({
        next: () => {
          void this.auditService!.log(actor, meta.action, meta.targetType, targetId);
        },
      }),
    );
  }
}
