/**
 * getting from https://github.com/enable3d/enable3d/blob/58fc224dc3b5430580c8989ed403a8be57114dd3/packages/ammoPhysics/src/physics.ts
 */

import {
  Vector3,
  Quaternion,
  Matrix4,
  Geometry,
  BufferGeometry,
  Mesh
} from 'three';
import { iterateGeometries, createHACDShapes } from '../../assets/js/three-to-ammo';

declare var Ammo;

export class Physics {
  private readonly complexShapes = ['plane', 'hull', 'hacd', 'vhacd', 'convexMesh', 'concaveMesh']

  constructor(private MASS?: number) {}

  public get mass(): number {
    return this.MASS;
  }
  public set mass(m: number) {
    this.MASS = m;
  }

  public get add() {
    return {
      existing: (object: Mesh, config?: any) => this.addExisting(object, config),
    }
  }

  private prepareThreeObjectForCollisionShape(object: Mesh, config?: any) {
    const { autoCenter = false } = config

    // set default params
    const defaultParams = {
      width: 1,
      height: 1,
      depth: 1,
      radius: 1,
      radiusTop: 1, // for the cylinder
      radiusBottom: 1, // for the cylinder
      tube: 0.4, // for the torus
      tubularSegments: 6 // for the torus
    }

    // determine the shape (fallback to hacd)
    let shape: string = 'unknown'
    // retrieve the shape from the geometry
    const type = object.geometry?.type || 'unknown'
    if (/box/i.test(type)) shape = 'box'
    else if (/cone/i.test(type)) shape = 'cone'
    else if (/cylinder/i.test(type)) shape = 'cylinder'
    else if (/extrude/i.test(type)) shape = 'extrude'
    else if (/plane/i.test(type)) shape = 'plane'
    else if (/sphere/i.test(type)) shape = 'sphere'
    else if (/torus/i.test(type)) shape = 'torus'

    // @ts-ignore
    let params = { ...defaultParams, ...object?.geometry?.parameters }

    params = { ...defaultParams, ...config }
    shape = config.shape

    // Add all default params if undefined
    Object.keys(params).forEach(key => {
      // @ts-ignore
      if (typeof params[key] === 'undefined' && defaultParams[key]) {
        // @ts-ignore
        params[key] = defaultParams[key]
      }
    })

    // auto adjust the center for custom shapes
    if (autoCenter) object.geometry.center()

    // adjust the cylinder radius for its physcis body
    if (shape === 'cylinder') params.radius = config.radius || params.radiusTop

    // some aliases
    if (shape === 'extrude') shape = 'hacd'
    if (shape === 'mesh' || shape === 'convex') shape = 'convexMesh'
    if (shape === 'concave') shape = 'concaveMesh'

    // if we have not found a shape until here, we fallback to 'box'
    if (shape === 'unknown') {
      shape = 'box'
    }

    return { shape, params, object }
  }

  public createCollisionShape(shape: string, params: any, object?: Mesh) {
    const btHalfExtents = new Ammo.btVector3()

    // transform geometry to bufferGeometry (because three-to-ammo works only with bufferGeometry)
    const geometry = object?.geometry as Geometry
    if (object && geometry?.isGeometry) {
      object.geometry = new BufferGeometry().fromGeometry(geometry)
    }

    // prepare data to pass to three-to-ammo.js
    const extractData = (object: any) => {
      const matrixWorld = new Matrix4().elements
      const vertices: any[] = []
      const matrices: any[] = []
      const indexes: any[] = []
      iterateGeometries(object, {}, (vertexArray: any, matrixArray: any, indexArray: any) => {
        vertices.push(vertexArray)
        matrices.push(matrixArray)
        indexes.push(indexArray)
      })

      return { vertices, matrices, indexes, matrixWorld }
    }

    let d = {} as any
    // extract data for complex shapes generated with three-to-ammo.js
    if (this.complexShapes.indexOf(shape) !== -1) d = extractData(object)

    let collisionShape = createHACDShapes(d.vertices, d.matrices, d.indexes, d.matrixWorld, params)
    Ammo.destroy(btHalfExtents)

    // if there is a x, y or z, take is as temporary offset parameter
    const { x, y, z } = params
    if (x || y || z) {
      // @ts-ignore
      collisionShape.offset = { x: x || 0, y: y || 0, z: z || 0 }
    }

    // in some cases, like hacd, it will be an array of shapes
    // so we merge them
    if (Array.isArray(collisionShape)) collisionShape = this.mergeCollisionShapesToCompoundShape(collisionShape)

    return collisionShape /*as Ammo.btCollisionShape*/
  }

  public mergeCollisionShapesToCompoundShape(collisionShapes/*: Ammo.btCollisionShape[]*/)/*: Ammo.btCompoundShape*/ {
    const compoundShape = new Ammo.btCompoundShape()
    collisionShapes.forEach(shape => {
      // @ts-ignore
      const { offset } = shape // offset is a custom parameter

      const transform = new Ammo.btTransform()
      transform.setIdentity()
      if (offset) transform.getOrigin().setValue(offset.x || 0, offset.y || 0, offset.z || 0)
      compoundShape.addChildShape(transform, shape)
    })
    return compoundShape
  }

  protected addExisting(object: Mesh, config: any): any {
    const pos = new Vector3()
    const quat = new Quaternion()
    const scale = new Vector3()
    object.getWorldPosition(pos)
    object.getWorldQuaternion(quat)
    object.getWorldScale(scale)

    const isStaticObject = false; // (config.collisionFlags || 0).toString(2).slice(-1) === '1'
    const isKinematicObject = false; // (config.collisionFlags || 0).toString(2).slice(-2, -1) === '1'

    const {
      shape = 'unknown',
      compound = [],
      mass = isStaticObject || isKinematicObject ? 0 : this.mass, // set default mass of 0 for static objects, and 1 for all other objects
      addChildren = true,
      margin = 0.01,
      ignoreScale = false
    } = config

    if (ignoreScale) scale.set(1, 1, 1)
    let collisionShapes;
    let localTransform;
    let rigidBody;
    if (compound.length >= 1) {
      // if we want a custom compound shape, we simply do
      collisionShapes = compound.map((s: any) => this.createCollisionShape(s.shape, s))
      const compoundShape = this.mergeCollisionShapesToCompoundShape(collisionShapes)
      localTransform = this.finishCollisionShape(compoundShape, pos, quat, scale, margin)
      rigidBody = this.collisionShapeToRigidBody(compoundShape, localTransform, mass, isKinematicObject)
      object.userData.body.ignoreScale = ignoreScale
      return rigidBody;
    }

    collisionShapes = [];
    let p = this.prepareThreeObjectForCollisionShape(object, config)
    let cs = this.createCollisionShape(p.shape, p.params, p.object)
    collisionShapes.push(cs)

    // check if the object has children
    if (shape === 'unknown' && addChildren && object.children.length >= 1) {
      object.children.forEach((child: any) => {
        if (child.isMesh) {
          p = this.prepareThreeObjectForCollisionShape(child)
          cs = this.createCollisionShape(p.shape, p.params, p.object)
          // @ts-ignore
          cs.offset = child.position.clone() // this is relative position to its parent
          collisionShapes.push(cs)
        }
      })
    }

    // FALLBACK: if we do not have any collisionShapes yet, add a simple box as a fallback
    if (collisionShapes.length === 0) {
      p = this.prepareThreeObjectForCollisionShape(object, config)
      cs = this.createCollisionShape(p.shape, p.params, p.object)
      collisionShapes.push(cs)
    }

    const collisionShape = collisionShapes.length === 1 ? collisionShapes[0] : this.mergeCollisionShapesToCompoundShape(collisionShapes)


    localTransform = this.finishCollisionShape(collisionShape, pos, quat, scale, margin);
    rigidBody = this.collisionShapeToRigidBody(collisionShape, localTransform, mass, isKinematicObject);
    rigidBody.setActivationState( 4 );
    return rigidBody;
  }

  public finishCollisionShape(
    collisionShape: any, // Ammo.btCollisionShape,
    pos: Vector3,
    quat: Quaternion,
    scale: Vector3,
    margin: number
  ) {
    collisionShape.setMargin(margin)

    const rotation = new Ammo.btQuaternion(0, 0, 0, 1)
    rotation.setValue(quat.x, quat.y, quat.z, quat.w)

    const localTransform = new Ammo.btTransform()
    localTransform.setIdentity()
    localTransform.getOrigin().setValue(pos.x, pos.y, pos.z)
    localTransform.setRotation(rotation)

    Ammo.destroy(rotation)

    const localScale = new Ammo.btVector3(scale.x, scale.y, scale.z)
    collisionShape.setLocalScaling(localScale)
    Ammo.destroy(localScale)

    return localTransform
  }

  public collisionShapeToRigidBody(
    collisionShape: any,
    localTransform: any,
    mass: number,
    disableDeactivation: boolean
  ) {
    const motionState = new Ammo.btDefaultMotionState(localTransform)
    const localInertia = new Ammo.btVector3(0, 0, 0)
    if (mass > 0) collisionShape.calculateLocalInertia(mass, localInertia)
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, collisionShape, localInertia)
    const rigidBody = new Ammo.btRigidBody(rbInfo)
    if (mass > 0 || disableDeactivation) rigidBody.setActivationState(4) // Disable deactivation
    return rigidBody
  }


}