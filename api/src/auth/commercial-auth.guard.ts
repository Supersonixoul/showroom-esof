import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { extractBearerToken } from './pro-auth.guard';

/// Payload signé par CommerciauxService.login() (rubrique "Traitement").
/// `role: 'AGENT_COMMERCIAL'` — volontairement distinct de la valeur
/// `Role.COMMERCIAL` (comptes internes User de l'Espace commercial) pour
/// éviter qu'un jeton Espace commercial ne soit accepté ici par erreur,
/// même principe que ProAuthGuard (role 'PRO' distinct de Role.ADMIN).
export interface AgentCommercialJwtPayload {
  sub: string;
  identifiant: string;
  role: 'AGENT_COMMERCIAL';
}

/// Guard pour les routes de la rubrique "Traitement" — réservées à un
/// AgentCommercial authentifié (distinct du Professionnel/Pro et du User
/// interne). Vérifie le JWT signé par CommerciauxService.login() et expose
/// le commercial courant sur `request.commercial`.
@Injectable()
export class CommercialAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync<AgentCommercialJwtPayload>(token);
      if (payload.role !== 'AGENT_COMMERCIAL') {
        throw new UnauthorizedException();
      }
      request.commercial = { agentCommercialId: payload.sub, identifiant: payload.identifiant };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
