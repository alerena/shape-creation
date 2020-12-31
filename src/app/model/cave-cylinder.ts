import { Face3, Geometry, Mesh, MeshPhongMaterial, Quaternion, Vector3 } from "three";

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

    // Side Angle Side triangle
    private getSideBySaS(sideA: number, angle: number, sideB: number) {
        return Math.sqrt(Math.pow(sideA, 2) + Math.pow(sideB, 2) - (2 * sideA * sideB * Math.cos(angle)));
    }

    private degreeToRad(degree: number) {
        if (!degree) { return 0; }
        return degree * Math.PI / 180;
    }

    private createvertices(
        originLatoMaggiore: {x: number, y: number}, originLatoMinore: {x: number, y: number},
        radiant: number, externalSide: number, internalSide: number, deltaLato: number, depth: number
    ): {vertici: Vector3[], origineLatoMaggiore: {x: number, y: number}, origineLatoMinore: {x: number, y: number}} {
        const myvertices: Vector3[] = [];
        const b: {x: number, y: number} = {
            x: externalSide * Math.cos(radiant) + originLatoMaggiore.x,
            y: externalSide * Math.sin(radiant) + originLatoMaggiore.y
        };
        const c: {x: number, y: number} = {
            x: internalSide * Math.cos(radiant) + originLatoMinore.x,
            y: internalSide * Math.sin(radiant) + originLatoMinore.y
        };

        myvertices.push(new Vector3( originLatoMaggiore.x, 0, originLatoMaggiore.y ));
        myvertices.push(new Vector3( b.x, 0, b.y ));
        myvertices.push(new Vector3( c.x, 0, c.y ));
        myvertices.push(new Vector3( originLatoMinore.x, 0, originLatoMinore.y ));

        myvertices.push(new Vector3( originLatoMaggiore.x, this.params.height, originLatoMaggiore.y ));
        myvertices.push(new Vector3( b.x, this.params.height, b.y ));
        myvertices.push(new Vector3( c.x, this.params.height, c.y ));
        myvertices.push(new Vector3( originLatoMinore.x, this.params.height, originLatoMinore.y ));
        return {
            vertici: myvertices,
            origineLatoMaggiore: b,
            origineLatoMinore: c
        };
    }

    createModel(pos: Vector3, quat?: Quaternion): Mesh { 
    //Array<{model: Mesh, body: any}> {
        const geometry = new Geometry();
        let angle = this.degreeToRad(360 / this.segments);
        // In pratica divido il mio poligono regolare in n triangoli che hanno due lati che misurano il raggio della circonferenza
        const externalSide = this.getSideBySaS(this.params.externalRadius, angle, this.params.externalRadius);
        const internalSide = this.getSideBySaS(this.params.internalRadius, angle, this.params.internalRadius);
        const deltaLato = (externalSide - internalSide) / 2;
        angle = (this.degreeToRad(180) - angle) / 2;
        const depth = this.params.externalRadius - this.params.internalRadius;
        const radiant = this.degreeToRad(180) - 2 * angle;
        let variazioneRadiant = 0;
        geometry.vertices = [
            new Vector3( 0, 0, 0 ),
            new Vector3( externalSide, 0, 0 ),
            new Vector3( externalSide - deltaLato, 0, depth ),
            new Vector3( deltaLato, 0, depth ),

            new Vector3( 0, this.params.height, 0 ),
            new Vector3( externalSide, this.params.height, 0 ),
            new Vector3( externalSide - deltaLato, this.params.height, depth ),
            new Vector3( deltaLato, this.params.height, depth )
        ];
        geometry.faces = [
            new Face3( 0, 1, 2 ),
            new Face3( 0, 2, 3 ),
            new Face3( 6, 5, 4),
            new Face3( 7, 6, 4),
            new Face3(6, 7, 3),
            new Face3(2, 6, 3),
            new Face3(5, 1, 0),
            new Face3(4, 5, 0),
        ];
        let verticesResults;
        let originLatoMaggiore: {x: number, y: number};
        let originLatoMinore: {x: number, y: number};
        originLatoMaggiore = {
            x: externalSide,
            y: 0
        };
        originLatoMinore = {
            x: externalSide - deltaLato,
            y: depth
        };
        let value;
        for (let i = 0; i < this.segments; i++) {
            variazioneRadiant += radiant;
            verticesResults = this.createvertices(
                originLatoMaggiore, originLatoMinore, variazioneRadiant, externalSide, internalSide, deltaLato, depth
            );
            geometry.vertices.push(...verticesResults.vertici);
            originLatoMaggiore = verticesResults.origineLatoMaggiore;
            originLatoMinore = verticesResults.origineLatoMinore;
            value = 8 * (i + 1);
            geometry.faces.push(
                new Face3(geometry.faces[0].a + value, geometry.faces[0].b + value, geometry.faces[0].c + value),
                new Face3(geometry.faces[1].a + value, geometry.faces[1].b + value, geometry.faces[1].c + value),
                new Face3(geometry.faces[2].a + value, geometry.faces[2].b + value, geometry.faces[2].c + value),
                new Face3(geometry.faces[3].a + value, geometry.faces[3].b + value, geometry.faces[3].c + value),
                new Face3(geometry.faces[4].a + value, geometry.faces[4].b + value, geometry.faces[4].c + value),
                new Face3(geometry.faces[5].a + value, geometry.faces[5].b + value, geometry.faces[5].c + value),
                new Face3(geometry.faces[6].a + value, geometry.faces[6].b + value, geometry.faces[6].c + value),
                new Face3(geometry.faces[7].a + value, geometry.faces[7].b + value, geometry.faces[7].c + value),
            );
        }
        geometry.verticesNeedUpdate = true;
        geometry.normalsNeedUpdate = true;
        geometry.computeBoundingSphere();
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        const scale = new Vector3(1, 1, 1);
        let obj = new Mesh(geometry, new MeshPhongMaterial({color: this.params.color}));
        obj.position.set(pos.x, pos.y, pos.z);
        obj.scale.set(scale.x, scale.y, scale.z);
        if (quat) {
            obj.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
        obj.castShadow = true;
        obj.receiveShadow = true;
        
        // move the cylinder 'cause the position that I passed in params would be the cylinder's center
        obj.position.x -= externalSide / 2;
        obj.position.z -= this.params.externalRadius * Math.sin(angle) / Math.sin(this.degreeToRad(90));
        
        return obj;
    }


    createPhysic(obj: Mesh): any {
        const geometry: Geometry = obj.geometry as Geometry;
        // const triangles = [];
        const vertices = geometry.vertices;
        let myshape = new Ammo.btConvexHullShape();
        const shape = new Ammo.btCompoundShape();
        let transform;
        let count = 0;
        vertices.forEach(vertice => {
            count++;
            myshape.addPoint(new Ammo.btVector3(vertice.x, vertice.y, vertice.z));
            if (count === 8) {
                transform = new Ammo.btTransform();
                transform.setIdentity();
                transform.setOrigin( new Ammo.btVector3( 0, 0, 0 ) );
                shape.addChildShape(transform, myshape);
                myshape = new Ammo.btConvexHullShape();
            }
        });
        transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3( obj.position.x, obj.position.y, obj.position.z ) );
        transform.setRotation( new Ammo.btQuaternion(
            obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w
        ) );
        const motionState = new Ammo.btDefaultMotionState( transform );

        shape.setMargin( 0.05 );
        const localInertia = new Ammo.btVector3( 1, 1, 1 );
        shape.calculateLocalInertia( this.params.mass, localInertia );

        const rbInfo = new Ammo.btRigidBodyConstructionInfo( this.params.mass, motionState, shape, localInertia );
        const body = new Ammo.btRigidBody( rbInfo );

        obj.userData.physicsBody = body;
        obj.userData.tag = obj.name;
        obj.userData.objectOnPosition = this;

        body.threeObject = obj;
        return body;
    }
}
