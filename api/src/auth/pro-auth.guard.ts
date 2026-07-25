import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface ProJwtPayload {
  sub: string;
  identifiant: string;
  role: 'PRO';
}

/// Guard pour les routes réservées aux comptes Pro (Professionnel) —
/// distinct de JwtAuthGuard/RolesGuard qui protègent les comptes internes
/// (User, role ADMIN/COMMERCIAL). Vérifie le JWT signé par
/// ProfessionnelsService.login() (payload.role === 'PRO') et expose le
/// compte Pro courant sur `request.pro`.
@Injectable()
export class ProAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync<ProJwtPayload>(token);
      if (payload.role !== 'PRO') {
        throw new UnauthorizedException();
      }
      request.pro = { professionnelId: payload.sub, identifiant: payload.identifiant };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export function extractBearerToken(request: {
  headers: { authorization?: string };
}): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length);
}
