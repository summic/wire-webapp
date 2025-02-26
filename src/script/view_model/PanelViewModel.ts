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

import ko from 'knockout';
import {amplify} from 'amplify';

import {WebAppEvents} from '@wireapp/webapp-events';

import {AddParticipantsViewModel} from './panel/AddParticipantsViewModel';
import {ConversationDetailsViewModel} from './panel/ConversationDetailsViewModel';
import {ConversationParticipantsViewModel} from './panel/ConversationParticipantsViewModel';
import {GroupParticipantServiceViewModel} from './panel/GroupParticipantServiceViewModel';
import {GroupParticipantUserViewModel} from './panel/GroupParticipantUserViewModel';
import {GuestsAndServicesViewModel} from './panel/GuestsAndServicesViewModel';
import {MessageDetailsViewModel} from './panel/MessageDetailsViewModel';
import {MotionDuration} from '../motion/MotionDuration';
import {ContentViewModel} from './ContentViewModel';
import type {MainViewModel, ViewModelRepositories} from './MainViewModel';
import type {Conversation} from '../entity/Conversation';
import type {User} from '../entity/User';
import type {Message} from '../entity/message/Message';
import type {BasePanelViewModel} from './panel/BasePanelViewModel';
import type {ServiceEntity} from '../integration/ServiceEntity';
import {ConversationState} from '../conversation/ConversationState';
import {container} from 'tsyringe';

import './panel/TimedMessagesPanel';
import './panel/ParticipantDevicesPanel';
import './panel/NotificationsPanel';

export const OPEN_CONVERSATION_DETAILS = 'PanelViewModel.OPEN_CONVERSATION_DETAILS';

type PanelEntity = Conversation | User | Message | ServiceEntity;

export type PanelParams = {
  addMode?: boolean;
  entity: PanelEntity;
  highlighted?: User[];
  showLikes?: boolean;
};

export class PanelViewModel {
  mainViewModel: MainViewModel;
  repositories: ViewModelRepositories;
  elementId: string;
  conversationEntity: ko.Observable<Conversation>;
  stateHistory: {params: PanelParams; state: string}[];
  isAnimating: ko.Observable<boolean>;
  isVisible: ko.PureComputed<boolean>;
  exitingState: ko.Observable<string>;
  state: ko.Observable<string>;
  subViews: Record<string, BasePanelViewModel>;
  STATE: Record<string, string>;
  currentEntity: PanelEntity;

  static get STATE() {
    return {
      ADD_PARTICIPANTS: 'PanelViewModel.STATE.ADD_PARTICIPANTS',
      CONVERSATION_DETAILS: 'PanelViewModel.STATE.CONVERSATION_DETAILS',
      CONVERSATION_PARTICIPANTS: 'PanelViewModel.STATE.CONVERSATION_PARTICIPANTS',
      GROUP_PARTICIPANT_SERVICE: 'PanelViewModel.STATE.GROUP_PARTICIPANT_SERVICE',
      GROUP_PARTICIPANT_USER: 'PanelViewModel.STATE.GROUP_PARTICIPANT_USER',
      GUEST_OPTIONS: 'PanelViewModel.STATE.GUEST_OPTIONS',
      MESSAGE_DETAILS: 'PanelViewModel.STATE.MESSAGE_DETAILS',
      NOTIFICATIONS: 'PanelViewModel.STATE.NOTIFICATIONS',
      PARTICIPANT_DEVICES: 'PanelViewModel.STATE.DEVICES',
      TIMED_MESSAGES: 'PanelViewModel.STATE.TIMED_MESSAGES',
    };
  }

  elementIds = {
    [PanelViewModel.STATE.ADD_PARTICIPANTS]: 'add-participants',
    [PanelViewModel.STATE.CONVERSATION_DETAILS]: 'conversation-details',
    [PanelViewModel.STATE.CONVERSATION_PARTICIPANTS]: 'conversation-participants',
    [PanelViewModel.STATE.GROUP_PARTICIPANT_SERVICE]: 'group-participant-service',
    [PanelViewModel.STATE.GROUP_PARTICIPANT_USER]: 'group-participant-user',
    [PanelViewModel.STATE.GUEST_OPTIONS]: 'guest-options',
    [PanelViewModel.STATE.MESSAGE_DETAILS]: 'message-details',
    [PanelViewModel.STATE.NOTIFICATIONS]: 'notification-settings',
    [PanelViewModel.STATE.PARTICIPANT_DEVICES]: 'participant-devices',
    [PanelViewModel.STATE.TIMED_MESSAGES]: 'timed-messages',
  };

  buildSubViews() {
    const viewModels = {
      [PanelViewModel.STATE.ADD_PARTICIPANTS]: AddParticipantsViewModel,
      [PanelViewModel.STATE.CONVERSATION_DETAILS]: ConversationDetailsViewModel,
      [PanelViewModel.STATE.CONVERSATION_PARTICIPANTS]: ConversationParticipantsViewModel,
      [PanelViewModel.STATE.GROUP_PARTICIPANT_SERVICE]: GroupParticipantServiceViewModel,
      [PanelViewModel.STATE.GROUP_PARTICIPANT_USER]: GroupParticipantUserViewModel,
      [PanelViewModel.STATE.GUEST_OPTIONS]: GuestsAndServicesViewModel,
      [PanelViewModel.STATE.MESSAGE_DETAILS]: MessageDetailsViewModel,
    };

    return Object.entries(viewModels).reduce<Record<string, any>>((subViews, [state, viewModel]) => {
      subViews[state] = new viewModel({
        isVisible: ko.pureComputed(this._isStateVisible.bind(this, state)),
        mainViewModel: this.mainViewModel,
        navigateTo: this._navigateTo,
        onClose: this.closePanel,
        onGoBack: this._goBack,
        onGoToRoot: this._goToRoot,
        repositories: this.repositories,
      });
      return subViews;
    }, {});
  }

  /**
   * View model for the details column.
   */
  constructor(mainViewModel: MainViewModel, repositories: ViewModelRepositories) {
    const conversationState = container.resolve(ConversationState);

    this.elementId = 'right-column';
    this.repositories = repositories;
    this.mainViewModel = mainViewModel;

    this.conversationEntity = conversationState.activeConversation;
    this.stateHistory = [];

    this.isAnimating = ko.observable(false);
    this.state = ko.observable();
    this.isVisible = ko.pureComputed(() => !!this.state());
    this.exitingState = ko.observable();

    this.conversationEntity.subscribe(this._forceClosePanel, undefined, 'beforeChange');
    this.subViews = this.buildSubViews();
    this.STATE = PanelViewModel.STATE;

    amplify.subscribe(WebAppEvents.CONTENT.SWITCH, this._switchContent);
    amplify.subscribe(OPEN_CONVERSATION_DETAILS, this._goToRoot);
    amplify.subscribe(WebAppEvents.CONVERSATION.MESSAGE.UPDATED, (oldId: string, updatedMessageEntity: Message) => {
      if (this.state() === PanelViewModel.STATE.MESSAGE_DETAILS && oldId === this.currentEntity.id) {
        this.currentEntity = updatedMessageEntity;
      }
    });

    ko.applyBindings(this, document.getElementById(this.elementId));
  }

  /**
   * Toggles (open/close) a panel.
   * If the state given is the one visible (and the parameters are the same), the panel closes.
   * Else the panels opens on the given state.
   *
   * Note: panels that are toggled are not counted in the state history.
   */
  readonly togglePanel = (state: string, params: PanelParams): void => {
    const isStateChange = this.state() !== state;
    if (!isStateChange) {
      const isNewParams = params?.entity !== this.currentEntity;
      if (!isNewParams) {
        this.closePanel();
        return;
      }
    }
    this._openPanel(state, params);
  };

  /**
   * Graciously closes the current opened panel.
   */
  closePanel = async (): Promise<boolean> => {
    if (this.isAnimating()) {
      return false;
    }

    this.isAnimating(true);
    await this.mainViewModel.closePanel();
    this._resetState();
    return true;
  };

  /**
   * Will navigate from the current state to the new state.
   */
  private readonly _navigateTo = (newState: string, params: PanelParams): void => {
    this._switchState(newState, this.state(), params);
    this.stateHistory.push({params, state: newState});
  };

  private readonly _forceClosePanel = (): void => {
    if (this.isVisible()) {
      this.mainViewModel.closePanelImmediately();
      this._resetState();
    }
  };

  private readonly _resetState = (): void => {
    this.isAnimating(false);
    this._hidePanel(this.state(), true);
    this.state(undefined);
    this.stateHistory = [];
    this.currentEntity = undefined;
  };

  private readonly _isStateVisible = (state: string): boolean => {
    const isStateActive = this.state() === state;
    const isStateExiting = this.exitingState() === state;
    return (isStateExiting || isStateActive) && this.isVisible();
  };

  private readonly _goBack = (): void => {
    this.stateHistory.pop();
    const toHistory = this.stateHistory[this.stateHistory.length - 1];
    const {state, params} = toHistory;
    this._switchState(state, this.state(), params, true);
  };

  private readonly _goToRoot = (): void => {
    this._openPanel(PanelViewModel.STATE.CONVERSATION_DETAILS, {entity: this.conversationEntity()}, true);
  };

  private readonly _switchContent = (newContentState: string): void => {
    const stateIsCollection = newContentState === ContentViewModel.STATE.COLLECTION;
    if (stateIsCollection) {
      this._forceClosePanel();
    }
  };

  private readonly _switchState = (toState: string, fromState: string, params: PanelParams, fromLeft = false): void => {
    this.currentEntity = params.entity;
    this.subViews[toState]?.initView?.(params);

    const isSameState = fromState === toState;
    if (isSameState) {
      return;
    }

    if (!fromState) {
      this._showPanel(toState);
      return;
    }

    this.exitingState(fromState);

    const fromPanel = document.querySelector(`#${this.elementIds[fromState]}`);
    const toPanel = this._showPanel(toState);
    window.requestAnimationFrame(() => {
      toPanel?.classList.add(`panel__page--move-in${fromLeft ? '--left' : '--right'}`);
      fromPanel?.classList.add(`panel__page--move-out${fromLeft ? '--left' : '--right'}`);

      window.setTimeout(() => {
        toPanel?.classList.remove('panel__page--move-in--left', 'panel__page--move-in--right');
        fromPanel?.classList.remove('panel__page--move-out--left', 'panel__page--move-out--right');
        this._hidePanel(fromState);
      }, MotionDuration.MEDIUM);
    });
  };

  private readonly _hidePanel = (state: string, forceInvisible = false): void => {
    if (!this.elementIds[state]) {
      return;
    }
    this.exitingState(undefined);

    const panelStateElementId = this.elementIds[state];
    const exitPanel = document.querySelector(`#${panelStateElementId}`);
    exitPanel?.classList.remove('panel__page--move-out--left', 'panel__page--move-out--right');
    if (this.state() !== state || forceInvisible) {
      exitPanel?.classList.remove('panel__page--visible');
    }
  };

  private readonly _openPanel = (newState: string, params: PanelParams, overrideAnimating = false): void => {
    if (!this.isAnimating() || overrideAnimating) {
      this._hidePanel(this.state(), true);
      const rootState = PanelViewModel.STATE.CONVERSATION_DETAILS;
      const rootParams = {entity: this.conversationEntity()};
      this.stateHistory = [
        {params: rootParams, state: rootState},
        {params, state: newState},
      ];
      this.isAnimating(true);
      this.exitingState(undefined);
      this._switchState(newState, undefined, params, true);
      this.mainViewModel.openPanel().then(() => this.isAnimating(false));
    }
  };

  private readonly _showPanel = (newPanelState: string): Element | undefined => {
    this.state(newPanelState);

    const panelStateElementId = this.elementIds[newPanelState];
    if (panelStateElementId) {
      const element = document.querySelector(`#${panelStateElementId}`);
      element?.classList.add('panel__page--visible');
      return element;
    }

    return undefined;
  };
}
