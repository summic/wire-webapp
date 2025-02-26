/*
 * Wire
 * Copyright (C) 2019 Wire Swiss GmbH
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

import {waitFor} from '@testing-library/react';
import type {RichInfo} from '@wireapp/api-client/src/user/';
import {act} from 'react-dom/test-utils';
import {User} from 'src/script/entity/User';
import {RichProfileRepository} from 'src/script/user/RichProfileRepository';
import TestPage from 'Util/test/TestPage';
import {createRandomUuid} from 'Util/util';
import EnrichedFields, {EnrichedFieldsProps} from './EnrichedFields';
import {Config, Configuration} from '../../Config';
import type {TypeUtil} from '@wireapp/commons';

class EnrichedFieldsPage extends TestPage<EnrichedFieldsProps> {
  constructor(props?: EnrichedFieldsProps) {
    super(EnrichedFields, props);
  }

  getEntries = () => this.get('[data-uie-name="item-enriched-key"]');
  findByValue = (expectedValue: string) =>
    this.get(`[data-uie-name="item-enriched-value"][data-uie-value="${expectedValue}"]`);
}

const richInfo: Partial<RichInfo> = {
  fields: [
    {type: 'field1', value: 'value1'},
    {type: 'field2', value: 'value2'},
  ],
};

const createRichProfileRepository = () => {
  const richProfileRepository = new RichProfileRepository();
  jest
    .spyOn(richProfileRepository, 'getUserRichProfile')
    .mockImplementation(() => Promise.resolve(richInfo as RichInfo));
  return richProfileRepository;
};

describe('EnrichedFields', () => {
  it('displays all the given fields', async () => {
    const richProfileRepository = createRichProfileRepository();
    const user = new User(createRandomUuid(), null);
    const enrichedFields = new EnrichedFieldsPage({richProfileRepository, user});

    await act(() =>
      waitFor(() => {
        expect(richProfileRepository.getUserRichProfile).toHaveBeenCalled();
      }),
    );
    enrichedFields.update();
    expect(enrichedFields.getEntries().length).toEqual(2);
  });

  it('displays the email if set on user', async () => {
    const richProfileRepository = createRichProfileRepository();
    const user = new User(createRandomUuid(), null);
    user.email('user@inter.net');
    const enrichedFields = new EnrichedFieldsPage({richProfileRepository, user});

    await act(() =>
      waitFor(() => {
        expect(richProfileRepository.getUserRichProfile).toHaveBeenCalled();
      }),
    );
    enrichedFields.update();
    expect(enrichedFields.getEntries().length).toEqual(3);
  });

  it('displays the domain of a user when the federation feature flag is turned on', async () => {
    spyOn<{getConfig: () => TypeUtil.RecursivePartial<Configuration>}>(Config, 'getConfig').and.returnValue({
      FEATURE: {
        ENABLE_FEDERATION: true,
      },
    });

    const richProfileRepository = createRichProfileRepository();
    const domain = 'wire.com';
    const user = new User(createRandomUuid(), domain);
    const enrichedFields = new EnrichedFieldsPage({richProfileRepository, user});
    await act(() =>
      waitFor(() => {
        expect(richProfileRepository.getUserRichProfile).toHaveBeenCalled();
      }),
    );
    enrichedFields.update();
    expect(enrichedFields.findByValue(domain).length).toBe(1);
  });

  it('does NOT display the domain of a user when the federation feature flag is turned off', async () => {
    spyOn<{getConfig: () => TypeUtil.RecursivePartial<Configuration>}>(Config, 'getConfig').and.returnValue({
      FEATURE: {
        ENABLE_FEDERATION: false,
      },
    });

    const richProfileRepository = createRichProfileRepository();
    const domain = 'wire.com';
    const user = new User(createRandomUuid(), domain);
    const enrichedFields = new EnrichedFieldsPage({richProfileRepository, user});
    await act(() =>
      waitFor(() => {
        expect(richProfileRepository.getUserRichProfile).toHaveBeenCalled();
      }),
    );
    enrichedFields.update();
    expect(enrichedFields.findByValue(domain).length).toBe(0);
  });

  it('calls the `onFieldsLoaded` function when fields are loaded', async () => {
    const richProfileRepository = createRichProfileRepository();
    const user = new User(createRandomUuid(), null);
    const onFieldsLoaded = jest.fn();
    const enrichedFields = new EnrichedFieldsPage({onFieldsLoaded, richProfileRepository, user});

    await act(() =>
      waitFor(() => {
        expect(richProfileRepository.getUserRichProfile).toHaveBeenCalled();
      }),
    );
    enrichedFields.update();
    expect(onFieldsLoaded).toHaveBeenCalledWith(richInfo.fields);
  });
});
