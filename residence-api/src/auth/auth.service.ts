// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Service Prisma global
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Vérifie les identifiants et récupère l'utilisateur avec ses permissions
   */
  async validateUser(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Charger l'utilisateur avec son rôle et les permissions liées
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true, // Inclusion de l'entité Permission
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    // 2. Comparer le mot de passe fourni avec le hash stocké en base
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    // 3. Extraire un tableau simple contenant uniquement les codes de permissions (ex: ['booking:create', 'finance:view'])
    const permissionsCodes = user.role.permissions.map(
      (rp) => rp.permission.code,
    );

    // Ne pas renvoyer le hash du mot de passe dans le résultat
    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      roleName: user.role.name,
      permissions: permissionsCodes,
    };
  }

  /**
   * Génère le token JWT d'accès
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    // Payload injecté dans le Token JWT
    const payload = {
      sub: user.id, // Subject (ID de l'utilisateur)
      email: user.email,
      role: user.roleName,
      permissions: user.permissions, // Permet au PermissionsGuard d'accéder directement aux droits
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleName,
        permissions: user.permissions,
      },
    };
  }
}