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

import type {LegalHoldMemberData} from '@wireapp/api-client/src/team/legalhold/';
import type {MemberData, Members} from '@wireapp/api-client/src/team/member/';
import type {FeatureList} from '@wireapp/api-client/src/team/feature/';
import type {Services} from '@wireapp/api-client/src/team/service/';
import type {ConversationRolesList} from '@wireapp/api-client/src/conversation/ConversationRole';
import type {TeamChunkData, TeamData} from '@wireapp/api-client/src/team/team/';
import {FeatureStatus, FEATURE_KEY} from '@wireapp/api-client/src/team/feature/';
import {container} from 'tsyringe';

import {APIClient} from '../service/APIClientSingleton';

export class TeamService {
  constructor(private readonly apiClient = container.resolve(APIClient)) {}

  getTeamConversationRoles(teamId: string): Promise<ConversationRolesList> {
    return this.apiClient.teams.conversation.api.getRoles(teamId);
  }

  getTeamById(teamId: string): Promise<TeamData> {
    return this.apiClient.teams.team.api.getTeam(teamId);
  }

  getTeamMember(teamId: string, userId: string): Promise<MemberData> {
    return this.apiClient.teams.member.api.getMember(teamId, userId);
  }

  getLegalHoldState(teamId: string, userId: string): Promise<LegalHoldMemberData> {
    return this.apiClient.teams.legalhold.api.getMemberLegalHold(teamId, userId);
  }

  sendLegalHoldApproval(teamId: string, userId: string, password: string): Promise<void> {
    return this.apiClient.teams.legalhold.api.putMemberApproveLegalHold(teamId, userId, password);
  }

  getAllTeamMembers(teamId: string): Promise<Members> {
    return this.apiClient.teams.member.api.getAllMembers(teamId);
  }

  getTeamMembersByIds(teamId: string, userIds: string[]): Promise<MemberData[]> {
    return this.apiClient.teams.member.api.getMembers(teamId, {ids: userIds});
  }

  getTeams(): Promise<TeamChunkData> {
    return this.apiClient.teams.team.api.getTeams();
  }

  getWhitelistedServices(teamId: string): Promise<Services> {
    return this.apiClient.teams.service.api.getTeamServices(teamId);
  }

  getAllTeamFeatures(): Promise<FeatureList> {
    return this.apiClient.teams.feature.api.getAllFeatures().catch(() => {
      // The following code enables all default features to ensure that modern webapps work with legacy backends (backends that don't provide a "feature-configs" endpoint)
      const defaultFeatures: FeatureList = {
        [FEATURE_KEY.APPLOCK]: {
          config: {
            enforceAppLock: false,
            inactivityTimeoutSecs: 60,
          },
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.CLASSIFIED_DOMAINS]: {
          config: {
            domains: [],
          },
          status: FeatureStatus.DISABLED,
        },
        [FEATURE_KEY.CONFERENCE_CALLING]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.DIGITAL_SIGNATURES]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.FILE_SHARING]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.LEGALHOLD]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.SEARCH_VISIBILITY]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.SSO]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.VALIDATE_SAML_EMAILS]: {
          status: FeatureStatus.ENABLED,
        },
        [FEATURE_KEY.VIDEO_CALLING]: {
          status: FeatureStatus.ENABLED,
        },
      };
      return defaultFeatures;
    });
  }
}
