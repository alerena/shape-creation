import { ElementRef, Injectable, NgZone } from '@angular/core';
import { AmbientLight, BoxBufferGeometry, Clock, Light, Mesh, MeshPhongMaterial, PerspectiveCamera, PointLight, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CaveCylinder } from '../model/cave-cylinder';
import { Sphere } from '../model/sphere';

declare var Ammo: any;

@Injectable({
  providedIn: 'root'
})
export class EngineService {
  private frameId: number = null;
  private canvas: HTMLCanvasElement;

  private camera: PerspectiveCamera;
  private scene: Scene;
  private light: Light;
  private controls: OrbitControls
  private renderer: WebGLRenderer;

  private clock: Clock;
  private tmpTrans: any;
  private ammoTmpPos: any;
  private ammoTmpQuat: any;
  private physicsWorld: any;
  private rigidBodies: Array<Mesh> = [];

  constructor(
    private ngZone: NgZone
  ) { }

  /** CREATE SCENE AND CREATE PHYSICS */
  async createScene(canvas: ElementRef) {
    // The first step is to get the reference of the canvas element from our HTML document
    this.canvas = canvas.nativeElement;
    await Ammo();
    await this.start();
  }

  private async start() {
    this.tmpTrans = new Ammo.btTransform();
    this.ammoTmpPos = new Ammo.btVector3();
    this.ammoTmpQuat = new Ammo.btQuaternion();
    this.setupPhysicsWorld();
    this.setupGraphics();
    this.setCamera();
    this.setControls();
    this.createTable();
    this.createObjects();
    this.animate();
  }

  private setCamera() {
    this.camera = new PerspectiveCamera(
      7, window.innerWidth / window.innerHeight, 0.2, 5000
    );
    this.scene.add(this.camera);
    this.camera.position.set( 0, 70, 140 );
    this.camera.lookAt(this.scene.position);
  }

  private setLight() {
    // soft white light
    this.light = new AmbientLight( 0xffffff, 0.5 );
    this.scene.add(this.light);
    const pointLight = new PointLight( 0xffffff, 1 );
    pointLight.position.set(0, 25, 125 );
    this.scene.add(pointLight);
  }

  private setControls() {
    this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.controls.maxPolarAngle = Math.PI * 0.5;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 550;
    this.controls.saveState();
  }

  private setupGraphics(){
    // create clock for timing
    this.clock = new Clock();

    // create the scene
    this.scene = new Scene();

    this.setLight();

    // Setup the renderer
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,    // transparent background
      antialias: true // smooth edges
    });
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.shadowMap.enabled = true;
  }

  animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      if (document.readyState !== 'loading') {
        this.render();
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          this.render();
        });
      }
    });
  }

  render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render();
    });

    if (this.clock){
      const deltaTime = this.clock.getDelta();
      this.updatePhysics( deltaTime );
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.camera) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize( width, height );
    }
  }

  /* AMMMO JS|PHYSIC PART */
  private setupPhysicsWorld(){
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const overlappingPairCache = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();

    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
  }

  updatePhysics( deltaTime: number ){
    // Step world
    this.physicsWorld.stepSimulation( deltaTime, 10 );

    // Update rigid bodies
    for (const rigidBody of this.rigidBodies) {
      const objThree: Mesh = rigidBody;
      const objAmmo = objThree.userData.physicsBody;
      const ms = objAmmo.getMotionState();
      if ( ms ) {
          ms.getWorldTransform( this.tmpTrans );
          const p = this.tmpTrans.getOrigin();
          const q = this.tmpTrans.getRotation();
          if (!objThree.name?.includes('pinza')) {
            objThree.position.set( p.x(), p.y(), p.z() );
            objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
          }
      }
    }
  }

  private createTable(){
    const pos = {x: 0, y: 0, z: 0};
    const scale = { x: 20, y: 2, z: 20 };
    const quat = {x: 0, y: 0, z: 0, w: 1};
    const mass = 0;

    // threeJS Section
    const blockPlane = new Mesh(new BoxBufferGeometry(1, 1, 1), new MeshPhongMaterial({color: 0xa0afa4}));

    blockPlane.position.set(pos.x, pos.y, pos.z);
    blockPlane.scale.set(scale.x, scale.y, scale.z);

    blockPlane.castShadow = true;
    blockPlane.receiveShadow = true;

    this.scene.add(blockPlane);

    // Ammojs Section
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    const motionState = new Ammo.btDefaultMotionState( transform );

    const colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
    colShape.setMargin( 0.05 );

    const localInertia = new Ammo.btVector3( 0, 0, 0 );
    colShape.calculateLocalInertia( mass, localInertia );

    const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
    const body = new Ammo.btRigidBody( rbInfo );

    blockPlane.userData.physicsBody = body;
    blockPlane.userData.tag = 'tavolo';

    body.setFriction(4);
    body.setRollingFriction(10);

    body.threeObject = blockPlane;

    this.physicsWorld.addRigidBody( body );
  }

  private createObjects() {
    const params = {
      color: '#3880ff',
      mass: 49,
      externalRadius: 0.25,
      internalRadius: 0.2,
      height: 0.5,
      segments: 32
    };
    const meshesAndBodies: Array<{mesh: Mesh, body: any}> = [];
    let mesh: Mesh;
    const cylinder = new CaveCylinder(params);
    mesh = cylinder.createModel(new Vector3(-3, 0, 0));
    meshesAndBodies.push( {mesh, body: cylinder.createPhysic(mesh)} );

    cylinder.color = '#eb445a';
    cylinder.height = 0.3;
    cylinder.externalRadius = 0.275;
    cylinder.internalRadius = 0.125;
    mesh = cylinder.createModel(new Vector3(0, 0, 0));
    meshesAndBodies.push( {mesh, body: cylinder.createPhysic(mesh)} );

    mesh = cylinder.createModel(new Vector3(4, 0, 0));
    meshesAndBodies.push( {mesh, body: cylinder.createPhysic(mesh)} );

    mesh = cylinder.createModel(new Vector3(6, 0, 0));
    meshesAndBodies.push( {mesh, body: cylinder.createPhysic(mesh)} );

    const radius = 0.27;
    const ball = new Sphere({
      color: '#2dd36f',
      radius,
      mass: 4
    });
    
    mesh = ball.createModel(new Vector3(8, 0, 0));
    meshesAndBodies.push( {mesh, body: ball.createPhysic(mesh)} );

    ball.color = '#5260ff';
    mesh = ball.createModel(new Vector3(-5, 0, 0));
    meshesAndBodies.push( {mesh, body: ball.createPhysic(mesh)} );
    
    meshesAndBodies.forEach(obj => {
      this.scene.add(obj.mesh);
      if (obj.body) {
        this.physicsWorld.addRigidBody(obj.body);
        this.rigidBodies.push(obj.mesh);
      }
    });
  }
}
