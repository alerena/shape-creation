import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { EngineService } from './engine.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit {
  @ViewChild('canvas', {read: ElementRef}) canvas: ElementRef

  constructor(
    private engine: EngineService,
    private loadingCtrl: LoadingController
  ) {}

  async ngAfterViewInit() {
    const loading = await this.loadingCtrl.create({
      message: 'loading',
    });
    loading.present();
    await this.engine.createScene(this.canvas);
    loading.dismiss();
  }

  ionViewDidEnter() {
    this.engine.resize();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.engine.resize();
  }

}
