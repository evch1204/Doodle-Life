# Turns the Hunyuan3D scan of the reference character into the game's player
# model: decimate, chibi proportions, rig, export.
#   blender -b -P tools/chibi/prep.py -- --render review/chibi-build --export src/assets/chibi.glb
# Source: review/chibi-ref/hunyuan.glb (Hunyuan3D 2.1, 1.5M faces, 4k PBR,
# faces -Y, feet at z=0, 1.144 m tall). L = +X (the character's left).
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

SRC = 'review/chibi-ref/hunyuan.glb'
FACES = 36000          # target triangle count for the game mesh
TEX = 2048             # base colour texture size in the GLB

def arg(name, default=None):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[a.index(name) + 1] if name in a else default

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

# ---------------------------------------------------------------------------
# chibi proportions: the scan is ~3.2 heads tall, the sheet ~2.7. Squash the
# body below the chin vertically (legs and torso), keep shoes and head as they
# are. Slope of z -> z' per band, blended over a few cm so there are no kinks.
# (z, slope) knots in source metres.
SLOPES = [(0.00, 1.0), (0.08, 1.0), (0.11, 0.80), (0.35, 0.80), (0.40, 0.74), (0.74, 0.74), (0.80, 1.0)]

def remap_table():
    zs = np.linspace(0, 1.2, 2401)
    kz, ks = zip(*SLOPES)
    slope = np.interp(zs, kz, ks)
    out = np.concatenate([[0], np.cumsum((slope[1:] + slope[:-1]) / 2 * np.diff(zs))])
    return zs, out

ZS, ZOUT = remap_table()

def remap_z(z):
    return np.interp(z, ZS, ZOUT)

# ---------------------------------------------------------------------------

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(SRC))
    ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = ob
    for o in bpy.data.objects:
        o.select_set(o == ob)
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.data.objects if o != ob]:
        bpy.data.objects.remove(o)
    # the import splits vertices along every UV seam (8.5k loose islands);
    # weld them or decimation tears the seams open
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def decimate(hi):
    """Low-poly copy of the scan. Collapsing smears the scan's UV seams, so the
    copy gets its own UVs and the colours are baked over from the scan."""
    ob = hi.copy(); ob.data = hi.data.copy()
    bpy.context.scene.collection.objects.link(ob)
    ob.name = ob.data.name = 'chibi'; hi.name = 'scan'
    bpy.context.view_layer.objects.active = ob
    d = ob.modifiers.new('decimate', 'DECIMATE')
    d.ratio = FACES / len(ob.data.polygons)
    bpy.ops.object.modifier_apply(modifier=d.name)
    # drop the scan's custom normals: smooth shading on the low mesh
    with bpy.context.temp_override(object=ob):
        if ob.data.has_custom_normals:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def bake(hi, ob):
    uv = ob.data.uv_layers
    while len(uv):
        uv.remove(uv[0])
    uv.new(name='UVMap')
    for o in bpy.data.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('chibi_albedo', TEX, TEX)
    mat = bpy.data.materials.new('chibi')
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.75
    nt.nodes.active = tex
    ob.data.materials.clear(); ob.data.materials.append(mat)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 1
    sc.render.bake.use_pass_direct = sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = True
    sc.render.bake.use_selected_to_active = True
    sc.render.bake.cage_extrusion = 0.01
    sc.render.bake.max_ray_distance = 0.03
    sc.render.bake.margin = 6
    hi.select_set(True); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE')
    bpy.data.objects.remove(hi)

def proportion(ob):
    n = len(ob.data.vertices)
    co = np.empty(n * 3); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    co[:, 0] -= 0.002                       # scan is ~2 mm off-centre in x
    co[:, 2] = remap_z(co[:, 2])
    ob.data.vertices.foreach_set('co', co.ravel())
    ob.data.update()


def smooth_normals(ob):
    """Shading normals from a softened copy: the scan's small bumps otherwise
    read as speckled creases in the game's normal-based outline pass. The
    surface itself (silhouette, folds) is unchanged."""
    soft = ob.copy(); soft.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(soft)
    m = soft.modifiers.new('smooth', 'SMOOTH'); m.factor = 1.0; m.iterations = 12
    dt = ob.modifiers.new('normals', 'DATA_TRANSFER')
    dt.object = soft
    dt.use_loop_data = True
    dt.data_types_loops = {'CUSTOM_NORMAL'}
    dt.loop_mapping = 'TOPOLOGY'
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=dt.name)
    bpy.data.objects.remove(soft)

# ---------------------------------------------------------------------------
# RIG: the joint chain the game's procedural animation drives (src/chibi.js):
# hips > spine > neck > head > hair, spine > upper arm > forearm,
# hips > thigh > shin > foot, spine > pack. Joints measured off a 5 cm grid
# over the front / side renders of the proportioned model.

BONES = [
    ('hips', (0, 0, 0.34), (0, 0, 0.40), None),
    ('spine', (0, 0, 0.36), (0, 0, 0.60), 'hips'),
    ('neck', (0, 0, 0.60), (0, 0, 0.665), 'spine'),
    ('head', (0, 0, 0.665), (0, 0, 0.95), 'neck'),
    ('hair', (0, 0, 0.95), (0, 0, 1.02), 'head'),
    # the pack pivots inside the back: hiding the pack scales it to here
    ('pack', (0, 0.03, 0.56), (0, 0.03, 0.62), 'spine'),
]
for side, sx in (('L', 1), ('R', -1)):
    BONES += [
        (f'thigh.{side}', (sx * 0.075, 0, 0.33), (sx * 0.075, 0, 0.19), 'hips'),
        (f'shin.{side}', (sx * 0.075, 0, 0.19), (sx * 0.075, 0, 0.065), f'thigh.{side}'),
        (f'foot.{side}', (sx * 0.075, 0, 0.065), (sx * 0.075, -0.09, 0.03), f'shin.{side}'),
        (f'upperarm.{side}', (sx * 0.12, 0, 0.60), (sx * 0.168, 0, 0.49), 'spine'),
        (f'forearm.{side}', (sx * 0.168, 0, 0.49), (sx * 0.162, -0.01, 0.37), f'upperarm.{side}'),
    ]

def build_armature():
    arm = bpy.data.armatures.new('chibi_rig')
    rig = bpy.data.objects.new('chibi_rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, h, t, parent in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail, b.roll = h, t, 0
        if parent:
            b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig

def skin(ob, rig):
    """Bone-heat weights for the limbs (they follow the mesh's own surface, so
    a hand resting against the pants stays with the arm), then fixed rules
    for the parts that move rigidly: head, loose hair, the pack."""
    for o in bpy.data.objects:
        o.select_set(o in (ob, rig))
    bpy.context.view_layer.objects.active = rig
    for b in rig.data.bones:
        b.use_deform = b.name not in ('hair', 'pack')
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in rig.data.bones:
        b.use_deform = True
    groups = {b.name: ob.vertex_groups.get(b.name) or ob.vertex_groups.new(name=b.name) for b in rig.data.bones}
    gi = {g.index: g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        p = v.co
        w = {gi[g.group]: g.weight for g in v.groups if g.weight > 1e-4}
        if not w:
            w = {'spine': 1.0}
        # the hoodie stays with the torso: no thigh / shin above the hem
        hem = float(smoothstep(0.345, 0.37, p.z))
        legw = sum(x for k, x in w.items() if k.startswith(('thigh', 'shin', 'foot')))
        if hem > 0 and legw > 0:
            w = {k: (x * (1 - hem) if k.startswith(('thigh', 'shin', 'foot')) else x) for k, x in w.items()}
            w['hips'] = w.get('hips', 0) + legw * hem
        # head + hair move as one; collar blends into the neck
        hd = float(smoothstep(0.655, 0.685, p.z))
        if hd > 0:
            w = {k: x * (1 - hd) for k, x in w.items()}
            loose = float(smoothstep(0.15, 0.2, (Vector((p.x, p.y, (p.z - 0.83) * 1.1))).length)) * float(smoothstep(0.78, 0.84, p.z)) * 0.7
            w['head'] = w.get('head', 0) + hd * (1 - loose)
            w['hair'] = w.get('hair', 0) + hd * loose
        # the bag (behind the back, below the hood) rides the pack bone
        if p.y > 0.07 and 0.27 < p.z < 0.59:
            w = {'pack': 1.0}
        tot = sum(w.values())
        for name, g in groups.items():
            x = w.get(name, 0) / tot
            if x > 1e-3:
                g.add([v.index], x, 'REPLACE')
            else:
                g.remove([v.index])

def export_glb(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB', export_skins=True,
                              export_animations=False, export_yup=True, export_image_format='JPEG',
                              export_image_quality=88, export_def_bones=True)

def test_pose(rig):
    """Bend every joint so the preview shows how the weights deform."""
    pb = rig.pose.bones
    rig.rotation_mode = 'XYZ'
    for n, r in (('upperarm.L', (-0.9, 0, 0)), ('forearm.L', (-0.8, 0, 0)), ('upperarm.R', (0.6, 0, -0.3)),
                 ('thigh.L', (-0.7, 0, 0)), ('shin.L', (1.0, 0, 0)), ('thigh.R', (0.4, 0, 0)), ('head', (0, 0, 0.4))):
        pb[n].rotation_mode = 'XYZ'; pb[n].rotation_euler = r

# ---------------------------------------------------------------------------
# preview renders

def setup_render(width, height):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w'); sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.87, 0.82, 0.71, 1)
    bg.inputs['Strength'].default_value = 1.0
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.5
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co)
    sc.camera = co
    return co

def aim(co, az_deg, center, dist=4.0):
    a = math.radians(az_deg)
    pos = center + Vector((math.sin(a) * dist, -math.cos(a) * dist, 0))
    co.location = pos
    co.rotation_euler = (center - pos).to_track_quat('-Z', 'Y').to_euler()

def render_views(out, names=None):
    os.makedirs(out, exist_ok=True)
    co = setup_render(600, 600)
    views = [('front', 0, 0.5, 1.1), ('right', 90, 0.5, 1.1), ('back', 180, 0.5, 1.1),
             ('left', 270, 0.5, 1.1), ('three_quarter', 35, 0.5, 1.1), ('head', 20, 0.8, 0.45)]
    for name, az, z, scale in views:
        if names and name not in names:
            continue
        co.data.ortho_scale = scale
        aim(co, az, Vector((0, 0, z)))
        bpy.context.scene.render.filepath = os.path.abspath(os.path.join(out, name + '.png'))
        bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------------------

scan = load()
ob = decimate(scan)
bake(scan, ob)
proportion(ob)
smooth_normals(ob)
print('faces', len(ob.data.polygons), 'verts', len(ob.data.vertices),
      'height', round(max(v.co.z for v in ob.data.vertices), 3))
rig = build_armature()
skin(ob, rig)
if arg('--export'):
    export_glb(arg('--export'))
if arg('--render'):
    render_views(arg('--render'))
if arg('--posed'):
    test_pose(rig)
    render_views(arg('--posed'), ['front', 'right', 'three_quarter'])
if arg('--blend'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(arg('--blend')))
