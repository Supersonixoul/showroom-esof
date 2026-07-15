import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { SubcategoriesModule } from './subcategories/subcategories.module';
import { GammesModule } from './gammes/gammes.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { UPLOADS_ROOT } from './media/multer.config';
import { VideosModule } from './videos/videos.module';
import { CatalogModule } from './catalog/catalog.module';
import { TvModule } from './tv/tv.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ServeStaticModule.forRoot({
      rootPath: UPLOADS_ROOT,
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    QuotesModule,
    BrandsModule,
    GammesModule,
    CategoriesModule,
    SubcategoriesModule,
    ProductsModule,
    MediaModule,
    VideosModule,
    CatalogModule,
    TvModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
