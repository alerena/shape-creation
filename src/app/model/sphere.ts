import { Mesh, MeshPhongMaterial, Quaternion, SphereBufferGeometry, Vector3 } from "three";

declare var Ammo;

export class Sphere {
    constructor(private params: {
        color: string,
        mass: number,
        radius: number,
    }){
    }

    set color(color: string) {
        this.params.color = color;
    }

    get color(): string {
        return this.params.color;
    }

    set radius(r: number) {
        this.params.radius = r;
    }

    get radius(): number {
        return this.params.radius;
    }

    createModel(pos: Vector3, quat?: Quaternion): Mesh {
        const buffer = new SphereBufferGeometry(this.params.radius, 32, 32);
        const scale = new Vector3(1, 1, 1);
        

        let mesh = new Mesh(buffer, new MeshPhongMaterial({color: this.params.color}));
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.scale.set(scale.x, scale.y, scale.z);
        if (quat) {
            mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = "ball";
        return mesh;
    }

    createPhysic(mesh: Mesh): any {
        const shape = new Ammo.btSphereShape( this.params.radius );
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3( mesh.position.x, mesh.position.y, mesh.position.z ) );
        transform.setRotation( new Ammo.btQuaternion(
            mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w
        ) );
        const motionState = new Ammo.btDefaultMotionState( transform );

        shape.setMargin( 0.05 );
        // scalo la massa per 50 volte perché tutto il mondo è scaltao x50 (125000 = 50^3)
        const localInertia = new Ammo.btVector3( 1, 1, 1 );
        shape.calculateLocalInertia( this.params.mass, localInertia );

        const rbInfo = new Ammo.btRigidBodyConstructionInfo( this.params.mass, motionState, shape, localInertia );
        const body = new Ammo.btRigidBody( rbInfo );

        if (this.params.mass && this.params.mass > 0) {
            body.setActivationState( 4 );
        } else {
            body.setCollisionFlags( 0 );
        }

        mesh.userData.physicsBody = body;
        mesh.userData.tag = mesh.name;
        mesh.userData.objectOnPosition = this;

        body.threeObject = mesh;
        return body;
    }
}
