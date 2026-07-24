import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { CreateProductSpecDto } from './dto/create-product-spec.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { MoveProductDto } from './dto/move-product.dto';
import { SetVisibilityDto } from './dto/set-visibility.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../generated/prisma/client';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/move')
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveProductDto) {
    return this.productsService.move(id, dto);
  }

  @Patch(':id/visibility')
  setVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVisibilityDto,
  ) {
    return this.productsService.setVisibility(id, dto.isActive);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, dto);
  }

  @Post(':id/specs')
  addSpec(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductSpecDto,
  ) {
    return this.productsService.addSpec(id, dto);
  }

  @Delete(':id/specs/:specId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSpec(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('specId', ParseUUIDPipe) specId: string,
  ) {
    return this.productsService.removeSpec(id, specId);
  }

  @Post(':id/images')
  addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductImageDto,
  ) {
    return this.productsService.addImage(id, dto);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productsService.removeImage(id, imageId);
  }

  @Patch(':id/images/:imageId/move')
  moveImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: MoveProductDto,
  ) {
    return this.productsService.moveImage(id, imageId, dto);
  }
}
