import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { extractBearerToken } from './pro-auth.guard';

/// Guard pour les routes accessibles à la fois par un AgentCommercial
/// (rubrique "Traitement") et par un compte admin (JwtStrategy, role
/// ADMIN) — ex. le téléchargement d'une proforma. Même principe que
/// ProOrAdminGuard.
@Injectable()
export class CommercialOrAdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload.role === 'AGENT_COMMERCIAL') {
        request.commercial = { agentCommercialId: payload.sub, identifiant: payload.identifiant };
      } else if (payload.role === 'ADMIN') {
        request.user = { userId: payload.sub, email: payload.email, role: payload.role };
      } else {
        throw new UnauthorizedException();
      }
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
