/*
 * Wire
 * Copyright (C) 2021 Wire Swiss GmbH
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

import {CALL_TYPE, STATE as CALL_STATE} from '@wireapp/avs';
import React, {Fragment, useEffect} from 'react';
import ReactDOM from 'react-dom';
import {container} from 'tsyringe';

import {useKoSubscribableChildren} from 'Util/ComponentUtil';

import {Call} from '../../calling/Call';
import {CallingRepository} from '../../calling/CallingRepository';
import {CallState} from '../../calling/CallState';
import {Participant} from '../../calling/Participant';
import {useVideoGrid} from '../../calling/videoGridHandler';
import {ConversationState} from '../../conversation/ConversationState';
import {Conversation} from '../../entity/Conversation';
import {ElectronDesktopCapturerSource, MediaDevicesHandler} from '../../media/MediaDevicesHandler';
import {MediaStreamHandler} from '../../media/MediaStreamHandler';
import {Multitasking} from '../../notification/NotificationRepository';
import {CallViewTab} from '../../view_model/CallingViewModel';
import ChooseScreen, {Screen} from './ChooseScreen';
import FullscreenVideoCall from './FullscreenVideoCall';

export interface CallingContainerProps {
  readonly callingRepository: CallingRepository;
  readonly callState?: CallState;
  readonly conversationState?: ConversationState;
  readonly mediaDevicesHandler: MediaDevicesHandler;
  readonly mediaStreamHandler: MediaStreamHandler;
  readonly multitasking: Multitasking;
}

const CallingContainer: React.FC<CallingContainerProps> = ({
  multitasking,
  callingRepository,
  mediaStreamHandler,
  mediaDevicesHandler,
  callState = container.resolve(CallState),
  conversationState = container.resolve(ConversationState),
}) => {
  const {isMinimized} = useKoSubscribableChildren(multitasking, ['isMinimized']);
  const {isMuted, activeCallViewTab, joinedCall, selectableScreens, selectableWindows, isChoosingScreen} =
    useKoSubscribableChildren(callState, [
      'isMuted',
      'activeCallViewTab',
      'joinedCall',
      'selectableScreens',
      'selectableWindows',
      'isChoosingScreen',
    ]);
  const {maximizedParticipant, state: currentCallState} = useKoSubscribableChildren(joinedCall, [
    'maximizedParticipant',
    'state',
  ]);

  useEffect(() => {
    if (currentCallState === CALL_STATE.MEDIA_ESTAB && joinedCall.initialType === CALL_TYPE.VIDEO) {
      multitasking.isMinimized(false);
    }
    if (currentCallState === undefined) {
      multitasking.isMinimized(true);
    }
  }, [currentCallState]);

  const videoGrid = useVideoGrid(joinedCall);

  const onCancelScreenSelection = () => {
    callState.selectableScreens([]);
    callState.selectableWindows([]);
  };

  const getConversationById = (conversationId: string): Conversation => {
    return conversationState.findConversation(conversationId);
  };

  const changePage = (newPage: number, call: Call) => {
    callingRepository.changeCallPage(newPage, call);
  };

  const leave = (call: Call) => {
    callingRepository.leaveCall(call.conversationId);
    callState.activeCallViewTab(CallViewTab.ALL);
    call.maximizedParticipant(null);
  };

  const setMaximizedParticipant = (call: Call, participant: Participant) => {
    call.maximizedParticipant(participant);
  };

  const setActiveCallViewTab = (tab: string) => {
    callState.activeCallViewTab(tab);
    if (tab === CallViewTab.ALL) {
      callingRepository.requestCurrentPageVideoStreams();
    }
  };

  const switchCameraInput = (call: Call, deviceId: string) => {
    mediaDevicesHandler.currentDeviceId.videoInput(deviceId);
  };

  const toggleCamera = (call: Call) => {
    callingRepository.toggleCamera(call);
  };

  const toggleMute = (call: Call, muteState: boolean) => {
    callingRepository.muteCall(call, muteState);
  };

  const toggleScreenshare = async (call: Call): Promise<void> => {
    if (call.getSelfParticipant().sharesScreen()) {
      return callingRepository.toggleScreenshare(call);
    }
    const showScreenSelection = (): Promise<void> => {
      return new Promise(resolve => {
        callingRepository.onChooseScreen = (deviceId: string): void => {
          mediaDevicesHandler.currentDeviceId.screenInput(deviceId);
          callState.selectableScreens([]);
          callState.selectableWindows([]);
          resolve();
        };
        mediaDevicesHandler.getScreenSources().then((sources: ElectronDesktopCapturerSource[]) => {
          if (sources.length === 1) {
            return callingRepository.onChooseScreen(sources[0].id);
          }
          callState.selectableScreens(sources.filter(source => source.id.startsWith('screen')));
          callState.selectableWindows(sources.filter(source => source.id.startsWith('window')));
        });
      });
    };

    mediaStreamHandler.selectScreenToShare(showScreenSelection).then(() => {
      const isAudioCall = [CALL_TYPE.NORMAL, CALL_TYPE.FORCED_AUDIO].includes(call.initialType);
      const isFullScreenVideoCall = call.initialType === CALL_TYPE.VIDEO && !multitasking.isMinimized();
      if (isAudioCall || isFullScreenVideoCall) {
        multitasking.isMinimized(true);
      }
      return callingRepository.toggleScreenshare(call);
    });
  };

  const conversation = conversationState.findConversation(joinedCall?.conversationId);
  if (!joinedCall || !conversation || conversation.removed_from_conversation()) {
    return null;
  }

  return (
    <Fragment>
      {!isMinimized && !!videoGrid?.grid.length && (
        <FullscreenVideoCall
          key={joinedCall.conversationId}
          videoGrid={videoGrid}
          call={joinedCall}
          activeCallViewTab={activeCallViewTab}
          conversation={getConversationById(joinedCall.conversationId)}
          multitasking={multitasking}
          canShareScreen={callingRepository.supportsScreenSharing}
          maximizedParticipant={maximizedParticipant}
          mediaDevicesHandler={mediaDevicesHandler}
          isMuted={isMuted}
          isChoosingScreen={isChoosingScreen}
          switchCameraInput={switchCameraInput}
          setMaximizedParticipant={setMaximizedParticipant}
          setActiveCallViewTab={setActiveCallViewTab}
          toggleMute={toggleMute}
          toggleCamera={toggleCamera}
          toggleScreenshare={toggleScreenshare}
          leave={leave}
          changePage={changePage}
        />
      )}

      {isChoosingScreen && (
        <ChooseScreen
          cancel={onCancelScreenSelection}
          choose={callingRepository.onChooseScreen}
          screens={selectableScreens as unknown as Screen[]}
          windows={selectableWindows as unknown as Screen[]}
        />
      )}
    </Fragment>
  );
};

export default {
  CallingContainer,
  init: (
    multitasking: Multitasking,
    callingRepository: CallingRepository,
    mediaStreamHandler: MediaStreamHandler,
    mediaDevicesHandler: MediaDevicesHandler,
  ) => {
    ReactDOM.render(
      <CallingContainer
        multitasking={multitasking}
        callingRepository={callingRepository}
        mediaStreamHandler={mediaStreamHandler}
        mediaDevicesHandler={mediaDevicesHandler}
      />,
      document.getElementById('calling-overlay-container'),
    );
  },
};
