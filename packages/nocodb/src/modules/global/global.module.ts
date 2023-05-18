import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { SocketGateway } from '../../gateways/socket.gateway';
import { Connection } from '../../connection/connection';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { NcConfig, prepareEnv } from '../../utils/nc-config';
import { UsersService } from '../../services/users/users.service';
import type { Provider } from '@nestjs/common';

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (usersService: UsersService, connection: Connection) => {
    const config = connection.config;

    const options = {
      // ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
      // expiresIn: '10h',
      passReqToCallback: true,
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
    };

    return new JwtStrategy(options, usersService);
  },
  inject: [UsersService, Connection],
};

@Global()
@Module({
  imports: [],
  providers: [
    {
      useFactory: async () => {
        // NC_DATABASE_URL_FILE, DATABASE_URL_FILE, DATABASE_URL, NC_DATABASE_URL to NC_DB
        await prepareEnv();

        const config = await NcConfig.createByEnv();
        return new Connection(config);
      },
      provide: Connection,
    },
    MetaService,
    UsersService,
    JwtStrategyProvider,
    GlobalGuard,
    ...(!process.env['NC_WORKER_CONTAINER'] ? [SocketGateway] : []),
  ],
  exports: [
    Connection,
    MetaService,
    JwtStrategyProvider,
    UsersService,
    GlobalGuard,
    ...(!process.env['NC_WORKER_CONTAINER'] ? [SocketGateway] : []),
  ],
})
export class GlobalModule {}
