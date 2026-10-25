import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticMeshes } from '../vercel-site/boutique/boutique-performance.js';

test('batching preserves exact bottle hit targets, moving objects and world transforms', () => {
  const scene = new THREE.Scene(), moving = new THREE.Group(); scene.add(moving);
  const material = new THREE.MeshStandardMaterial(); const interactives=[];
  for(let i=0;i<3;i++) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),material);
    mesh.position.set(i,0,0);mesh.userData.productId='exact-red';scene.add(mesh);interactives.push(mesh);
  }
  const hand=new THREE.Mesh(new THREE.BoxGeometry(),material);moving.add(hand);
  const before=interactives.slice();const stats=batchStaticMeshes(THREE,scene,[moving],interactives);
  assert.equal(stats.after,2);assert.equal(hand.parent,moving);assert.equal(interactives.length,1);
  assert.equal(interactives[0].userData.productId,'exact-red');
  scene.updateMatrixWorld(true);
  for(let i=0;i<3;i++) {
    const ray=new THREE.Raycaster(new THREE.Vector3(i,0,4),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObjects(interactives)[0];assert.ok(hit);assert.equal(hit.object.userData.productId,'exact-red');
    assert.ok(Math.abs(hit.point.x-i)<.001);
  }
  assert.ok(before.every(mesh=>!mesh.parent));
});
