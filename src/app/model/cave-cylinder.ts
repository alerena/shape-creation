import { ExtrudeBufferGeometry, Mesh, MeshPhongMaterial, Path, Quaternion, Shape, Vector3 } from "three";
import { Physics } from '../home/physics';

declare var Ammo;

export class CaveCylinder {

    private externalSide: number;
    private depth: number;

    constructor(private params: {
        color: string,
        mass: number,
        externalRadius: number,
        internalRadius: number,
        height: number
        segments: number
    }){
        this.params.segments = this.params.segments < 4 ? 4 : this.params.segments > 256 ? 256 : this.params.segments;
    }

    set color(color: string) {
        this.params.color = color;
    }

    get color(): string {
        return this.params.color;
    }

    set externalRadius(r: number) {
        this.params.externalRadius = r;
    }

    get externalRadius(): number {
        return this.params.externalRadius;
    }

    set height(h: number) {
        this.params.height = h;
    }

    get height(): number {
        return this.params.height;
    }

    set internalRadius(r: number) {
        this.params.internalRadius = r;
    }

    get internalRadius(): number {
        return this.params.internalRadius;
    }

    set segments(s: number) {
        this.params.segments = s < 4 ? 4 : s > 256 ? 256 : s;
    }

    get segments(): number {
        return this.params.segments;
    }

    set mass(m: number) {
        this.params.mass = m;
    }

    get mass(): number {
        return this.params.mass;
    }

    createModel(pos: Vector3, quat?: Quaternion): Mesh { 

        const extrudeSettings = {
            depth: this.params.height,
            steps: 1,
            bevelEnabled: false,
            curveSegments: this.params.segments
        }

        const arcShape = new Shape()
        arcShape.absarc(0, 0, this.params.externalRadius, 0, Math.PI * 2, false)

        const holePath = new Path()
        holePath.absarc(0, 0, this.params.internalRadius, 0, Math.PI * 2, true)
        arcShape.holes.push(holePath)

        const geo = new ExtrudeBufferGeometry(arcShape, extrudeSettings)
        const mat = new MeshPhongMaterial({ color: this.params.color })
        const mesh = new Mesh(geo, mat)
        geo.translate(0, 0, -0.25) // somehow this has an offset as well :/
        mesh.rotateX(Math.PI / 2);
        mesh.position.set(pos.x, pos.y, pos.z);
        return mesh;
    }


    createPhysic(obj: Mesh): any {
        const physics = new Physics(this.params.mass);
        const body = physics.add.existing(obj,  { shape: 'hacd' });
        obj.userData.physicsBody = body;
        obj.userData.tag = obj.name;
        obj.userData.objectOnPosition = this;

        body.threeObject = obj;
        return body;
    }
}
