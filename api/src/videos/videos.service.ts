import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { MoveVideoDto } from './dto/move-video.dto';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVideoDto) {
    const { _max } = await this.prisma.promoVideo.aggregate({
      _max: { position: true },
    });
    const position = (_max.position ?? -1) + 1;
    return this.prisma.promoVideo.create({ data: { ...dto, position } });
  }

  findAll() {
    return this.prisma.promoVideo.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
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

  async move(id: string, dto: MoveVideoDto) {
    const video = await this.findOne(id);

    const neighbor = await this.prisma.promoVideo.findFirst({
      where:
        dto.direction === 'up'
          ? { position: { lt: video.position } }
          : { position: { gt: video.position } },
      orderBy: { position: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      // Déjà en première (up) ou dernière (down) position : rien à faire.
      return video;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.promoVideo.update({
        where: { id: neighbor.id },
        data: { position: video.position },
      }),
      this.prisma.promoVideo.update({
        where: { id: video.id },
        data: { position: neighbor.position },
      }),
    ]);

    return updated;
  }
}
