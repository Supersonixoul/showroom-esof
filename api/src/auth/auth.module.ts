import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { ProAuthGuard } from './pro-auth.guard';
import { ProOrAdminGuard } from './pro-or-admin.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, ProAuthGuard, ProOrAdminGuard],
  exports: [JwtModule, RolesGuard, ProAuthGuard, ProOrAdminGuard],
})
export class AuthModule {}
