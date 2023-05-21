import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { SocketGateway } from '../../gateways/socket.gateway';
import { Connection } from '../../connection/connection';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { NcConfig, prepareEnv } from '../../utils/nc-config';
import { UsersService } from '../../services/users/users.service';
import Noco from '../../Noco';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';
import NcUpgrader from '../../version-upgrader/NcUpgrader';
import NocoCache from '../../cache/NocoCache';
import type { IEventEmitter } from '../event-emitter/event-emitter.interface';
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
    {
      useFactory: async (
        connection: Connection,
        eventEmitter: IEventEmitter,
      ) => {
        // set version
        process.env.NC_VERSION = '0105004';

        // init cache
        await NocoCache.init();

        // init meta service
        const metaService = new MetaService(connection);
        await metaService.init();

        // provide meta and config to Noco
        Noco._ncMeta = metaService;
        Noco.config = connection.config;
        Noco.eventEmitter = eventEmitter;

        // init plugin manager
        await NcPluginMgrv2.init(Noco.ncMeta);
        await Noco.loadEEState();

        // run upgrader
        await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });

        return metaService;
      },
      provide: MetaService,
      inject: [Connection, 'IEventEmitter'],
    },
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
