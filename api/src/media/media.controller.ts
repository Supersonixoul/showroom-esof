import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { unlink } from 'fs/promises';
import { multerConfig, MAX_IMAGE_SIZE, UploadResource } from './multer.config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { ImageOptimizationService } from '../products/image-optimization.service';

const IMAGE_RESOURCES: UploadResource[] = ['products', 'brands', 'categories', 'subcategories', 'gammes'];

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MediaController {
  constructor(
    private readonly imageOptimizationService: ImageOptimizationService,
  ) {}

  @Post('upload/:resource')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async upload(
    @Param('resource') resource: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (
      IMAGE_RESOURCES.includes(resource as UploadResource) &&
      file.size > MAX_IMAGE_SIZE
    ) {
      await unlink(file.path);
      throw new BadRequestException(
        `Taille maximale dépassée (5 Mo, fichier : ${(file.size / 1024 / 1024).toFixed(1)} Mo)`,
      );
    }
    // Pipeline d'optimisation : uniquement pour les images produits (pas les
    // vidéos promo, ni les logos/images des autres ressources — hors périmètre).
    if (resource === 'products' && file.mimetype.startsWith('image/')) {
      await this.imageOptimizationService.generateVariants(file.path);
    }
    return {
      url: `/uploads/${resource}/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
