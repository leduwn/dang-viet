"""
Dáng Việt - Master 3D Asset Authoring & Export Pipeline v2
Author: Dáng Việt Digital Studio & Blender Studio (CC0 Base Mesh)
Environment: Blender 3.6 LTS Headless

Generates:
1. avatar_v2.glb (with Avatar_Skin, Avatar_Hair, Avatar_Eyes + 5 shape keys)
2. aodai_traditional_v2.glb (with 4.2cm collar, raglan sleeves, waist slits, folded hem + 5 shape keys)
3. pants_silk_v2.glb (wide silk pants with 3D crotch & waistband + 5 shape keys)
4. dangviet_master_v2.blend (editable master scene)
"""

import os
import sys
import math
import bpy
import bmesh
from mathutils import Vector, Matrix

print("=== DÁNG VIỆT: AUTHORING 3D ASSETS V2 ===")

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VENDOR_BLEND = os.path.join(ROOT_DIR, "assets_src", "vendor", "blender-studio", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend")
OUTPUT_DIR = os.path.join(ROOT_DIR, "apps", "web", "public", "models")
MASTER_BLEND = os.path.join(ROOT_DIR, "assets_src", "models", "dangviet_master_v2.blend")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(MASTER_BLEND), exist_ok=True)

# -------------------------------------------------------------
# Clean startup scene
# -------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# -------------------------------------------------------------
# Helper: Create PBR Material
# -------------------------------------------------------------
def create_pbr_material(name, base_color, roughness=0.5, metalness=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
    return mat

mat_skin = create_pbr_material("Avatar_Skin", (0.92, 0.73, 0.62, 1.0), roughness=0.65, metalness=0.0)
mat_hair = create_pbr_material("Avatar_Hair", (0.05, 0.04, 0.04, 1.0), roughness=0.82, metalness=0.05)
mat_eyes = create_pbr_material("Avatar_Eyes", (0.12, 0.08, 0.05, 1.0), roughness=0.15, metalness=0.0)
mat_aodai = create_pbr_material("AoDaiMaterial", (0.78, 0.15, 0.20, 1.0), roughness=0.35, metalness=0.05)
mat_pants = create_pbr_material("PantsMaterial", (0.95, 0.95, 0.93, 1.0), roughness=0.42, metalness=0.02)

# -------------------------------------------------------------
# 1. Load CC0 Female Body Mesh & Eyes
# -------------------------------------------------------------
print("[1/5] Loading CC0 Base Mesh from Blender Studio...")

with bpy.data.libraries.load(VENDOR_BLEND, link=False) as (data_from, data_to):
    target_names = ["GEO-body_female_realistic", "GEO-body_female_realistic.eye.L", "GEO-body_female_realistic.eye.R"]
    data_to.objects = [name for name in target_names if name in data_from.objects]

body_obj = None
left_eye_obj = None
right_eye_obj = None

for obj in data_to.objects:
    bpy.context.scene.collection.objects.link(obj)
    if "eye.L" in obj.name:
        left_eye_obj = obj
    elif "eye.R" in obj.name:
        right_eye_obj = obj
    elif "body_female" in obj.name:
        body_obj = obj

assert body_obj is not None, "Failed to load GEO-body_female_realistic"
print(f"Loaded female body with {len(body_obj.data.vertices)} vertices.")

# Center body to origin (0, 0, 0)
body_obj.location = Vector((0.0, 0.0, 0.0))
bpy.context.view_layer.objects.active = body_obj
body_obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Adjust eyes relative to centered body (+1.3401 from vendor offset)
for eye_obj in [left_eye_obj, right_eye_obj]:
    if eye_obj:
        eye_obj.location.x += 1.3401
        bpy.context.view_layer.objects.active = eye_obj
        eye_obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# -------------------------------------------------------------
# 2. Extract Scalp Hair & Build Traditional Chignon Bun
# -------------------------------------------------------------
print("[2/5] Creating conforming hair cap from scalp & occipital chignon bun...")

bm_body = bmesh.new()
bm_body.from_mesh(body_obj.data)

scalp_faces = []
for f in bm_body.faces:
    c = f.calc_center_median()
    # Hairline: Forehead top
    if c.z >= 1.58 and c.y >= -0.115:
        scalp_faces.append(f)
    # Temples & crown sides
    elif 1.53 <= c.z < 1.58 and c.y >= -0.080:
        scalp_faces.append(f)
    # Lower occipital & nape of neck
    elif 1.47 <= c.z < 1.53 and c.y >= -0.010:
        scalp_faces.append(f)

bm_hair = bmesh.new()
v_map = {}
for f in scalp_faces:
    face_verts = []
    for v in f.verts:
        if v not in v_map:
            # Slight outward offset along normal (3.5mm)
            new_co = v.co + v.normal * 0.0035
            v_map[v] = bm_hair.verts.new(new_co)
        face_verts.append(v_map[v])
    try:
        bm_hair.faces.new(face_verts)
    except ValueError:
        pass

# Add traditional chignon bun at occipital back of head (Z=1.520, Y=+0.052, radius 3.8cm)
bun_matrix = Matrix.Translation(Vector((0.0, 0.052, 1.520)))
bmesh.ops.create_uvsphere(bm_hair, u_segments=16, v_segments=12, radius=0.038, matrix=bun_matrix)

hair_mesh = bpy.data.meshes.new("Mesh_Avatar_Hair")
bm_hair.to_mesh(hair_mesh)
bm_hair.free()
bm_body.free()

# Create integrated Avatar mesh with 3 material slots
avatar_mesh = bpy.data.meshes.new("Avatar_v2_Mesh")
bm_avatar = bmesh.new()

avatar_obj = bpy.data.objects.new("avatar_v2", avatar_mesh)
bpy.context.scene.collection.objects.link(avatar_obj)

avatar_obj.data.materials.append(mat_skin)  # slot 0
avatar_obj.data.materials.append(mat_hair)  # slot 1
avatar_obj.data.materials.append(mat_eyes)  # slot 2

# Add body vertices (slot 0: skin)
bm_avatar.from_mesh(body_obj.data)
for f in bm_avatar.faces:
    f.material_index = 0

# Add hair vertices (slot 1: hair)
bm_h = bmesh.new()
bm_h.from_mesh(hair_mesh)
hair_v_map = {}
for v in bm_h.verts:
    hair_v_map[v] = bm_avatar.verts.new(v.co)
for f in bm_h.faces:
    try:
        new_f = bm_avatar.faces.new([hair_v_map[v] for v in f.verts])
        new_f.material_index = 1
    except ValueError:
        pass
bm_h.free()

# Add eyes (slot 2: eyes)
for eye_obj in [left_eye_obj, right_eye_obj]:
    if eye_obj:
        bm_eye = bmesh.new()
        bm_eye.from_mesh(eye_obj.data)
        eye_v_map = {}
        for v in bm_eye.verts:
            eye_v_map[v] = bm_avatar.verts.new(eye_obj.matrix_world @ v.co)
        for f in bm_eye.faces:
            try:
                new_f = bm_avatar.faces.new([eye_v_map[v] for v in f.verts])
                new_f.material_index = 2
            except ValueError:
                pass
        bm_eye.free()

bm_avatar.to_mesh(avatar_mesh)
bm_avatar.free()

# Remove temporary objects
for temp_o in [body_obj, left_eye_obj, right_eye_obj]:
    if temp_o:
        bpy.data.objects.remove(temp_o, do_unlink=True)

print("Avatar v2 mesh built with 3 material slots (skin, hair, eyes).")

# -------------------------------------------------------------
# Helper: Morph Target Generator
# -------------------------------------------------------------
def apply_5_shape_keys(obj, is_garment=False, is_pants=False):
    """
    Creates 5 synchronized Shape Keys across Avatar, Ao Dai, and Silk Pants
    """
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis", from_mix=False)

    # 1. morph_petite: -5% height, -4% width
    sk_petite = obj.shape_key_add(name="morph_petite", from_mix=False)
    for v in obj.data.vertices:
        co = v.co.copy()
        new_z = 0.85 + (co.z - 0.85) * 0.95
        new_x = co.x * 0.96
        new_y = co.y * 0.96
        sk_petite.data[v.index].co = Vector((new_x, new_y, new_z))

    # 2. morph_tall_slender: +5% height, -3% width
    sk_tall = obj.shape_key_add(name="morph_tall_slender", from_mix=False)
    for v in obj.data.vertices:
        co = v.co.copy()
        new_z = 0.85 + (co.z - 0.85) * 1.05
        new_x = co.x * 0.97
        new_y = co.y * 0.97
        sk_tall.data[v.index].co = Vector((new_x, new_y, new_z))

    # 3. morph_broad_shoulders: +8% width at shoulders (Z: 1.15 to 1.40)
    sk_shoulders = obj.shape_key_add(name="morph_broad_shoulders", from_mix=False)
    for v in obj.data.vertices:
        co = v.co.copy()
        factor = 0.0
        if 1.15 < co.z < 1.40:
            dist = abs(co.z - 1.30) / 0.12
            factor = max(0.0, 1.0 - dist) * 0.08
        new_x = co.x * (1.0 + factor)
        sk_shoulders.data[v.index].co = Vector((new_x, co.y, co.z))

    # 4. morph_curvy_hips: +10% width at hips (Z: 0.75 to 1.08)
    sk_hips = obj.shape_key_add(name="morph_curvy_hips", from_mix=False)
    for v in obj.data.vertices:
        co = v.co.copy()
        factor = 0.0
        if 0.75 < co.z < 1.08:
            dist = abs(co.z - 0.92) / 0.14
            factor = max(0.0, 1.0 - dist) * 0.10
        new_x = co.x * (1.0 + factor)
        new_y = co.y * (1.0 + factor * 0.8)
        sk_hips.data[v.index].co = Vector((new_x, new_y, co.z))

    # 5. morph_plus_size: +10% overall torso volume
    sk_plus = obj.shape_key_add(name="morph_plus_size", from_mix=False)
    for v in obj.data.vertices:
        co = v.co.copy()
        factor = 0.0
        if 0.60 < co.z < 1.35:
            factor = 0.09
        elif co.z <= 0.60:
            factor = 0.05
        new_x = co.x * (1.0 + factor)
        new_y = co.y * (1.0 + factor * 1.1)
        sk_plus.data[v.index].co = Vector((new_x, new_y, co.z))

apply_5_shape_keys(avatar_obj)
print("Avatar v2 5 Shape Keys generated.")

# -------------------------------------------------------------
# 3. Build Ao Dai v2 (High Collar 4.2cm, Raglan, Waist Slits, Folded Hem)
# -------------------------------------------------------------
print("[3/5] Tailoring Ao Dai v2 over realistic female anatomy...")

bm_aodai = bmesh.new()

# 3.1 Standing Collar (Cổ đứng cao 4.2cm) - Folded Closed Rim
# Neck base is at Z=1.395, Collar reaches up to Z=1.437 (4.2cm standing collar)
collar_z_bottom = 1.395
collar_z_top = 1.437
collar_steps_z = 4
collar_circ_segs = 24
collar_r_outer = 0.064
collar_r_inner = 0.0622  # 1.8mm solid folded hem

outer_rings = []
inner_rings = []
for iz in range(collar_steps_z + 1):
    tz = iz / collar_steps_z
    z = collar_z_bottom + tz * (collar_z_top - collar_z_bottom)
    scale = 1.0 - 0.03 * tz
    ro = collar_r_outer * scale
    ri = collar_r_inner * scale
    outer_ring = []
    inner_ring = []
    for ic in range(collar_circ_segs):
        theta = ic * 2.0 * math.pi / collar_circ_segs
        x_o = ro * math.sin(theta)
        y_o = -0.012 + ro * math.cos(theta) * 1.10
        outer_ring.append(bm_aodai.verts.new(Vector((x_o, y_o, z))))
        x_i = ri * math.sin(theta)
        y_i = -0.012 + ri * math.cos(theta) * 1.10
        inner_ring.append(bm_aodai.verts.new(Vector((x_i, y_i, z))))
    outer_rings.append(outer_ring)
    inner_rings.append(inner_ring)

for iz in range(collar_steps_z):
    for ic in range(collar_circ_segs):
        ic_next = (ic + 1) % collar_circ_segs
        bm_aodai.faces.new([outer_rings[iz][ic], outer_rings[iz][ic_next], outer_rings[iz+1][ic_next], outer_rings[iz+1][ic]])
        bm_aodai.faces.new([inner_rings[iz][ic], inner_rings[iz+1][ic], inner_rings[iz+1][ic_next], inner_rings[iz][ic_next]])

for ic in range(collar_circ_segs):
    ic_next = (ic + 1) % collar_circ_segs
    bm_aodai.faces.new([outer_rings[-1][ic], inner_rings[-1][ic], inner_rings[-1][ic_next], outer_rings[-1][ic_next]])

# 3.2 Torso Envelope tailored to CC0 female anatomy
# (Z, rx, ry, center_y)
# Back Y = center_y + ry; Front Y = center_y - ry
torso_z_levels = [
    (1.395, 0.066, 0.075, -0.012),  # Neck base / collar seam
    (1.380, 0.138, 0.086, -0.012),  # Trapezius slope (body X=0.129)
    (1.350, 0.198, 0.098, -0.014),  # Shoulder slope (body X=0.187)
    (1.320, 0.220, 0.110, -0.018),  # Clavicle / shoulder tips (body X=0.210)
    (1.250, 0.205, 0.132, -0.035),  # Upper chest slope / armpit
    (1.185, 0.205, 0.155, -0.048),  # Bust apex (Front Y = -0.203, body front = -0.157: 46mm ease)
    (1.120, 0.180, 0.140, -0.044),  # Underbust (Front Y = -0.184, body front = -0.145: 39mm ease)
    (1.060, 0.165, 0.126, -0.045),  # Midriff (Front Y = -0.171, body front = -0.142: 29mm ease)
    (1.015, 0.158, 0.120, -0.046),  # Natural waist / Slit origin (Front Y = -0.166, body = -0.137)
]

torso_rings = []
for z, rx, ry, cy in torso_z_levels:
    ring = []
    for ic in range(collar_circ_segs):
        theta = ic * 2.0 * math.pi / collar_circ_segs
        x = rx * math.sin(theta)
        y = cy + ry * math.cos(theta)
        ring.append(bm_aodai.verts.new(Vector((x, y, z))))
    torso_rings.append(ring)

for iz in range(len(torso_z_levels) - 1):
    for ic in range(collar_circ_segs):
        ic_next = (ic + 1) % collar_circ_segs
        bm_aodai.faces.new([torso_rings[iz][ic], torso_rings[iz][ic_next], torso_rings[iz+1][ic_next], torso_rings[iz+1][ic]])

# Connect collar bottom to torso top
for ic in range(collar_circ_segs):
    ic_next = (ic + 1) % collar_circ_segs
    bm_aodai.faces.new([outer_rings[0][ic], torso_rings[0][ic], torso_rings[0][ic_next], outer_rings[0][ic_next]])

# 3.3 Raglan Long Sleeves (True 3D circular tubes along A-pose arm trajectory with capped shoulder dome)
arm_trajectory = [
    (0.188, 0.005, 1.320, 0.058),  # Shoulder / armpit
    (0.200, 0.012, 1.250, 0.055),  # Upper bicep
    (0.215, 0.020, 1.180, 0.052),  # Mid bicep
    (0.235, 0.025, 1.100, 0.048),  # Lower bicep
    (0.268, 0.020, 1.020, 0.046),  # Elbow
    (0.300, 0.000, 0.940, 0.044),  # Upper forearm
    (0.330, -0.022, 0.880, 0.042), # Forearm
    (0.355, -0.052, 0.820, 0.039), # Wrist hem
]

sleeve_circ = 12
for side in [1.0, -1.0]:  # 1.0 = Right, -1.0 = Left
    sleeve_rings = []
    for s, (cx, cy, cz, r_slv) in enumerate(arm_trajectory):
        if s < len(arm_trajectory) - 1:
            nxt = arm_trajectory[s + 1]
            T = Vector((nxt[0] - cx, nxt[1] - cy, nxt[2] - cz)).normalized()
        else:
            prv = arm_trajectory[s - 1]
            T = Vector((cx - prv[0], cy - prv[1], cz - prv[2])).normalized()

        ref = Vector((0.0, 1.0, 0.0)) if abs(T.y) < 0.85 else Vector((0.0, 0.0, 1.0))
        U = T.cross(ref).normalized()
        V = T.cross(U).normalized()

        s_ring = []
        center = Vector((side * cx, cy, cz))
        U_side = Vector((side * U.x, U.y, U.z))
        V_side = Vector((side * V.x, V.y, V.z))

        for sc in range(sleeve_circ):
            phi = sc * 2.0 * math.pi / sleeve_circ
            offset = r_slv * (math.cos(phi) * U_side + math.sin(phi) * V_side)
            s_ring.append(bm_aodai.verts.new(center + offset))
        sleeve_rings.append(s_ring)

    # Smooth shoulder dome cap at top of sleeve (s=0)
    apex = bm_aodai.verts.new(Vector((side * 0.188, 0.005, 1.340)))
    for sc in range(sleeve_circ):
        sc_next = (sc + 1) % sleeve_circ
        if side > 0:
            bm_aodai.faces.new([apex, sleeve_rings[0][sc_next], sleeve_rings[0][sc]])
        else:
            bm_aodai.faces.new([apex, sleeve_rings[0][sc], sleeve_rings[0][sc_next]])

    for s in range(len(arm_trajectory) - 1):
        for sc in range(sleeve_circ):
            sc_next = (sc + 1) % sleeve_circ
            v1 = sleeve_rings[s][sc]
            v2 = sleeve_rings[s][sc_next]
            v3 = sleeve_rings[s + 1][sc_next]
            v4 = sleeve_rings[s + 1][sc]
            if side > 0:
                bm_aodai.faces.new([v1, v2, v3, v4])
            else:
                bm_aodai.faces.new([v1, v4, v3, v2])

# 3.4 Front Flap & Back Flap (Tà trước & Tà sau xẻ eo Z=1.015 tới trên mắt cá Z=0.180)
# (Z, width, front_y, back_y)
flap_profile = [
    (1.015, 0.165, -0.165, 0.075),   # Waist slit origin
    (0.880, 0.200, -0.155, 0.138),   # High hip / buttock apex
    (0.720, 0.225, -0.145, 0.142),   # Crotch / low pelvis
    (0.550, 0.245, -0.135, 0.135),   # Mid-thigh
    (0.350, 0.265, -0.120, 0.130),   # Knee / calf
    (0.180, 0.280, -0.105, 0.128),   # Flap hem (above ankles)
]

# Front Flap (Tà trước)
front_grid = []
cols = 12
for z, w, f_y, _ in flap_profile:
    row = []
    for c in range(cols):
        tc = c / (cols - 1)
        x = (tc * 2.0 - 1.0) * w
        # Natural slight forward belly curve
        y = f_y - (1.0 - (x / w) ** 2) * 0.012
        row.append(bm_aodai.verts.new(Vector((x, y, z))))
    front_grid.append(row)

for r in range(len(flap_profile) - 1):
    for c in range(cols - 1):
        bm_aodai.faces.new([front_grid[r][c], front_grid[r][c+1], front_grid[r+1][c+1], front_grid[r+1][c]])

# Back Flap (Tà sau)
back_grid = []
for z, w, _, b_y in flap_profile:
    row = []
    for c in range(cols):
        tc = c / (cols - 1)
        x = (tc * 2.0 - 1.0) * w
        # Natural backward hip curve
        y = b_y + (1.0 - (x / w) ** 2) * 0.010
        row.append(bm_aodai.verts.new(Vector((x, y, z))))
    back_grid.append(row)

for r in range(len(flap_profile) - 1):
    for c in range(cols - 1):
        bm_aodai.faces.new([back_grid[r][c], back_grid[r+1][c], back_grid[r+1][c+1], back_grid[r][c+1]])

# 3.5 Folded Hem Solidification (1.8mm cloth thickness)
aodai_mesh = bpy.data.meshes.new("Mesh_AoDai_Traditional_v2")
bm_aodai.to_mesh(aodai_mesh)
bm_aodai.free()

aodai_obj = bpy.data.objects.new("aodai_traditional_v2", aodai_mesh)
bpy.context.scene.collection.objects.link(aodai_obj)
aodai_obj.data.materials.append(mat_aodai)

mod_sol = aodai_obj.modifiers.new("FoldedHem", "SOLIDIFY")
mod_sol.thickness = 0.0018  # 1.8mm true cloth thickness
mod_sol.offset = 0.0
mod_sol.use_rim = True
mod_sol.use_quality_normals = True

bpy.context.view_layer.objects.active = aodai_obj
bpy.ops.object.modifier_apply(modifier="FoldedHem")

for poly in aodai_obj.data.polygons:
    poly.use_smooth = True

apply_5_shape_keys(aodai_obj, is_garment=True)
print("Ao Dai v2 mesh built with 5 Shape Keys and Folded Hem.")

# -------------------------------------------------------------
# 4. Build Silk Pants v2 (3D Pelvis/Crotch & Two Wide Palazzo Legs)
# -------------------------------------------------------------
print("[4/5] Tailoring Silk Pants v2 (Waistband, 3D pelvis/crotch, two wide draping tubes)...")

bm_pants = bmesh.new()

# Pelvis & Waistband (Z=1.025 down to Z=0.690)
# (Z, rx, ry, center_y)
pelvis_z_levels = [
    (1.025, 0.158, 0.115, -0.045),  # Waistband (Front Y = -0.160, body = -0.139, Back Y = +0.070, body = +0.051)
    (0.940, 0.178, 0.124, -0.030),  # Upper hips (Front Y = -0.154, Back Y = +0.094)
    (0.860, 0.194, 0.130, +0.005),  # Mid hips (rx = 0.194 > body 0.168: 26mm ease, Front Y = -0.125, Back Y = +0.135)
    (0.800, 0.204, 0.128, +0.005),  # Max hips (rx = 0.204 > body 0.179: 25mm ease, Front Y = -0.123, Back Y = +0.133)
    (0.740, 0.200, 0.122, -0.005),  # Low pelvis
    (0.690, 0.195, 0.115, -0.010),  # Crotch overlap ring (rx = 0.195 > body 0.176: 19mm ease)
]

pelvis_circ = 24
pelvis_rings = []
for z, rx, ry, cy in pelvis_z_levels:
    ring = []
    for ic in range(pelvis_circ):
        theta = ic * 2.0 * math.pi / pelvis_circ
        x = rx * math.sin(theta)
        y = cy + ry * math.cos(theta)
        ring.append(bm_pants.verts.new(Vector((x, y, z))))
    pelvis_rings.append(ring)

for r in range(len(pelvis_z_levels) - 1):
    for ic in range(pelvis_circ):
        ic_next = (ic + 1) % pelvis_circ
        bm_pants.faces.new([pelvis_rings[r][ic], pelvis_rings[r][ic_next], pelvis_rings[r+1][ic_next], pelvis_rings[r+1][ic]])

# Two Distinct Wide Straight Leg Tubes (Palazzo drape down to tops of feet Z=0.040)
# (Z, r_leg, center_y)
leg_z_levels = [
    (0.740, 0.106, -0.010),   # Upper thigh / crotch overlap
    (0.680, 0.106, -0.010),   # Crotch split
    (0.600, 0.108, -0.008),   # High thigh
    (0.520, 0.110,  0.000),   # Mid thigh
    (0.420, 0.112,  0.010),   # Low thigh / knee top
    (0.320, 0.115,  0.025),   # Knee / calf
    (0.220, 0.118,  0.035),   # Mid calf
    (0.120, 0.122,  0.038),   # Ankle
    (0.040, 0.126,  0.042),   # Floor / top of shoe hem
]

leg_circ = 16
for side in [1.0, -1.0]:  # 1.0 = Right leg, -1.0 = Left leg
    leg_rings = []
    center_x = side * 0.104
    for z, r_leg, cy in leg_z_levels:
        l_ring = []
        for lc in range(leg_circ):
            alpha = lc * 2.0 * math.pi / leg_circ
            x = center_x + r_leg * math.sin(alpha)
            y = cy + r_leg * math.cos(alpha)
            l_ring.append(bm_pants.verts.new(Vector((x, y, z))))
        leg_rings.append(l_ring)

    for r in range(len(leg_z_levels) - 1):
        for lc in range(leg_circ):
            lc_next = (lc + 1) % leg_circ
            v1 = leg_rings[r][lc]
            v2 = leg_rings[r][lc_next]
            v3 = leg_rings[r+1][lc_next]
            v4 = leg_rings[r+1][lc]
            if side > 0:
                bm_pants.faces.new([v1, v2, v3, v4])
            else:
                bm_pants.faces.new([v1, v4, v3, v2])

pants_mesh = bpy.data.meshes.new("Mesh_Pants_Silk_v2")
bm_pants.to_mesh(pants_mesh)
bm_pants.free()

pants_obj = bpy.data.objects.new("pants_silk_v2", pants_mesh)
bpy.context.scene.collection.objects.link(pants_obj)
pants_obj.data.materials.append(mat_pants)

mod_sol_p = pants_obj.modifiers.new("FoldedHemPants", "SOLIDIFY")
mod_sol_p.thickness = 0.0015  # 1.5mm cloth thickness
mod_sol_p.offset = 0.0
mod_sol_p.use_rim = True

bpy.context.view_layer.objects.active = pants_obj
bpy.ops.object.modifier_apply(modifier="FoldedHemPants")

for poly in pants_obj.data.polygons:
    poly.use_smooth = True

apply_5_shape_keys(pants_obj, is_pants=True)
print("Silk Pants v2 mesh built with 5 Shape Keys.")

# -------------------------------------------------------------
# 5. Save Master Blend & Export GLB v2 Assets
# -------------------------------------------------------------
print("[5/5] Saving master .blend scene and exporting glTF 2.0 binaries...")

col_master = bpy.data.collections.new("DangViet_Master_v2")
bpy.context.scene.collection.children.link(col_master)
for o in [avatar_obj, aodai_obj, pants_obj]:
    col_master.objects.link(o)
    if o.name in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.unlink(o)

bpy.ops.wm.save_as_mainfile(filepath=MASTER_BLEND)
print(f"Master scene saved: {MASTER_BLEND}")

def export_single_glb(obj, output_path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_materials='EXPORT',
        export_colors=True,
        export_cameras=False,
        export_lights=False,
    )
    size_kb = os.path.getsize(output_path) / 1024
    print(f"Exported: {output_path} ({size_kb:.1f} KB)")

export_single_glb(avatar_obj, os.path.join(OUTPUT_DIR, "avatar_v2.glb"))
export_single_glb(aodai_obj, os.path.join(OUTPUT_DIR, "aodai_traditional_v2.glb"))
export_single_glb(pants_obj, os.path.join(OUTPUT_DIR, "pants_silk_v2.glb"))

print("\n=== PIPELINE HOÀN TẤT THÀNH CÔNG ===")
