/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {ConnectionStatus, Connection} from '@wireapp/api-client/src/connection/';
import {ConnectionMapper} from './ConnectionMapper';

describe('ConnectionMapper', () => {
  describe('mapConnectionFromJson', () => {
    it('maps accepted connection requests', () => {
      const payload: Connection = {
        conversation: '4a559f61-8466-45a7-b366-9e1662f02370',
        from: '109da9ca-a495-47a8-ac70-9ffbe924b2d0',
        last_update: '2017-02-14T12:43:31.460Z',
        message: '',
        status: ConnectionStatus.ACCEPTED,
        to: '39b7f597-dfd1-4dff-86f5-fe1b79cb70a0',
      };

      const connectionEntity = ConnectionMapper.mapConnectionFromJson(payload);

      expect(connectionEntity.conversationId).toBe(payload.conversation);
      expect(connectionEntity.from).toBe(payload.from);
      expect(connectionEntity.lastUpdate).toBe(payload.last_update);
      expect(connectionEntity.message).toBe(payload.message);
      expect(connectionEntity.status()).toBe(payload.status);
      expect(connectionEntity.userId).toBe(payload.to);

      expect(connectionEntity.isConnected()).toBeTruthy();
      expect(connectionEntity.isIncomingRequest()).toBeFalsy();
      expect(connectionEntity.isOutgoingRequest()).toBeFalsy();
    });
  });
});
