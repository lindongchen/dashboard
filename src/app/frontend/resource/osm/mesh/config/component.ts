// Copyright 2017 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {MeshconfigDetail} from '@api/root.api';
import {ActionbarService, ResourceMeta} from '@common/services/global/actionbar';
import {NotificationsService} from '@common/services/global/notifications';
import {EndpointManager, Resource} from '@common/services/resource/endpoint';
import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {NamespacedResourceService} from '@common/services/resource/resource';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {RawResource} from '@common/resources/rawresource';
import {AlertDialogConfig, AlertDialog} from 'common/dialogs/alert/dialog';
import {MatDialogConfig, MatDialog} from '@angular/material/dialog';
import lodash from 'lodash';

@Component({
  selector: 'kd-mesh-config',
  templateUrl: './template.html',
  styleUrls: ['style.scss'],
})
export class MeshConfigComponent implements OnInit, OnDestroy {
  meshconfig: MeshconfigDetail;
  isInitialized = false;
  podListEndpoint: string;
  ingressListEndpoint: string;
  eventListEndpoint: string;
	logLevels = [{value:'error',label:'Error'},{value:'info',label:'Info'}];

  private readonly endpoint_ = EndpointManager.resource(Resource.meshconfig, true);
  private readonly unsubscribe_ = new Subject<void>();

  constructor(
    private readonly http_: HttpClient,
    private readonly dialog_: MatDialog,
    private readonly service_: NamespacedResourceService<MeshconfigDetail>,
    private readonly actionbar_: ActionbarService,
    private readonly activatedRoute_: ActivatedRoute,
    private readonly notifications_: NotificationsService
  ) {}

  ngOnInit(): void {
    const resourceName = this.activatedRoute_.snapshot.params.resourceName;
    const resourceNamespace = this.activatedRoute_.snapshot.params.resourceNamespace;

    this.podListEndpoint = this.endpoint_.child(resourceName, Resource.pod, resourceNamespace);
    this.ingressListEndpoint = this.endpoint_.child(resourceName, Resource.ingress, resourceNamespace);
    this.eventListEndpoint = this.endpoint_.child(resourceName, Resource.event, resourceNamespace);

    this.service_
      .get(this.endpoint_.detail(), resourceName, resourceNamespace)
      .pipe(takeUntil(this.unsubscribe_))
      .subscribe((d: MeshconfigDetail) => {
        this.meshconfig = d;
        this.notifications_.pushErrors(d.errors);
        this.actionbar_.onInit.emit(new ResourceMeta('Meshconfig', d.objectMeta, d.typeMeta));
        this.isInitialized = true;
      });
  }
	save(): void {
		const url = RawResource.getUrl(this.meshconfig.typeMeta, this.meshconfig.objectMeta);
		this.http_.get(url, {headers: this.getHttpHeaders_(), responseType: 'text'})
		.subscribe(_result => {
			const result = JSON.parse(_result)
			result.spec = lodash.cloneDeep(this.meshconfig.spec);
			this.http_.put(url, result, {headers: this.getHttpHeaders_(), responseType: 'text'})
			.subscribe(_ => {
			}, this.handleErrorResponse_.bind(this));
		});
	}
  private getHttpHeaders_(): HttpHeaders {
    const headers = new HttpHeaders();
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return headers;
  }
  private handleErrorResponse_(err: HttpErrorResponse): void {
    if (err) {
      const alertDialogConfig: MatDialogConfig<AlertDialogConfig> = {
        width: '630px',
        data: {
          title: err.statusText === 'OK' ? 'Internal server error' : err.statusText,
          message: err.error || 'Could not perform the operation.',
          confirmLabel: 'OK',
        },
      };
      this.dialog_.open(AlertDialog, alertDialogConfig);
    }
  }
  ngOnDestroy(): void {
    this.unsubscribe_.next();
    this.unsubscribe_.complete();
    this.actionbar_.onDetailsLeave.emit();
  }
}