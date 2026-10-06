// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Déclenche la validation du token via la JwtStrategy
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si le token est invalide, expiré ou absent
    if (err || !user) {
      throw err || new UnauthorizedException('Token d\'accès invalide ou expiré.');
    }
    return user;
  }
}