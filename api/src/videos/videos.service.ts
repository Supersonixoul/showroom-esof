import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateVideoDto) {
    return this.prisma.promoVideo.create({ data: dto });
  }

  findAll() {
    return this.prisma.promoVideo.findMany({ orderBy: { position: 'asc' } });
  }

  async findOne(id: string) {
    const video = await this.prisma.promoVideo.findUnique({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Vidéo ${id} introuvable`);
    }
    return video;
  }

  async update(id: string, dto: UpdateVideoDto) {
    await this.findOne(id);
    return this.prisma.promoVideo.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.promoVideo.delete({ where: { id } });
  }
}
