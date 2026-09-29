"""
BLEND -> web pipeline for the Milky Way venue.

1. Read the Blender 5.0 file directly (no Blender needed) and bake world transforms.
2. Drop stray/outlier objects, classify the rest (walls / furniture / props / emissive / bulbs).
3. Decimate over-dense props per object (some Sketchfab imports are ~1M tris for a 10cm bottle).
4. Convert Blender Z-up diorama units into Y-up web units (x100, recentred on the hall).
5. Write:   venue-raw.glb   (one merged mesh per category -> 4 draw calls)
            venue-points.bin (surface samples for the galaxy->venue particle morph, + bulb centres)
            venue-meta.json  (bounds, wall segments, stats)
   gltf-transform then quantizes + meshopt-compresses the GLB.
"""
import sys,re,json,struct,math
sys.path.insert(0,__file__.rsplit('/',1)[0])
import numpy as np, fast_simplification as fs
from extract import load,fan

SRC=sys.argv[1]; OUT=sys.argv[2]
S=100.0; CX=0.10; CY=-0.15           # scale + recentre on the hall
def to_web(P): return np.stack([(P[:,0]-CX)*S, P[:,2]*S, -(P[:,1]-CY)*S],1).astype(np.float32)

R,objs=load(SRC)
def centre(o): return o['P'].mean(0)
def inside(o):
    c=centre(o); return -2.2<c[0]<2.45 and -1.3<c[1]<1.6 and -0.2<c[2]<0.5
def classify(o):
    n=o['name']; ext=o['P'].max(0)-o['P'].min(0)
    if re.match(r'Cylinder\.\d+$',n) and ext.max()<0.012: return 'bulb'
    if n=='Plane.012': return 'floor'
    if n.startswith('Plane.039') or n.startswith('Plane.04'): return 'floormark'
    if n.startswith('Plane') and ext[2]>0.1: return 'wall'
    if n.startswith('Plane'): return 'furniture'
    if 'Emissive' in n or 'emission' in n: return 'emissive'
    return 'prop'

def cluster(V,F,cell):
    q=np.floor(V/cell).astype(np.int64); _,inv=np.unique(q,axis=0,return_inverse=True); inv=inv.ravel()
    cnt=np.bincount(inv); Vc=np.stack([np.bincount(inv,V[:,k])/cnt for k in range(3)],1)
    Fc=inv[F]; Fc=Fc[(Fc[:,0]!=Fc[:,1])&(Fc[:,1]!=Fc[:,2])&(Fc[:,0]!=Fc[:,2])]
    _,ui=np.unique(np.sort(Fc,1),axis=0,return_index=True); Fc=Fc[np.sort(ui)]
    used=np.unique(Fc); remap=np.full(len(Vc),-1); remap[used]=np.arange(len(used))
    return Vc[used],remap[Fc]

cats={'wall':[],'furniture':[],'prop':[],'emissive':[]}
bulbs=[]; floor=None; marks=[]; dropped=[]; stats={'src_tris':0,'out_tris':0}
for o in objs:
    if not inside(o): dropped.append(o['name']); continue
    c=classify(o)
    tri,_=fan(o['po']); stats['src_tris']+=len(tri)
    if c=='bulb': bulbs.append(centre(o)); continue
    if c=='floor': floor=o; continue
    if c=='floormark':
        mn=o['P'].min(0); mx=o['P'].max(0); marks.append([mn[0],mn[1],mx[0],mx[1]]); continue
    V=o['P']; F=o['cv'][tri].astype(np.int64)
    # weld + budget: keep small props light, big architecture intact
    # budget scales with on-screen size: a 10cm bottle does not need a million triangles
    diag=float(np.linalg.norm(o['P'].max(0)-o['P'].min(0)))
    budget=int(np.clip(9000*diag,120,2400)) if c=='prop' else 20000
    if len(F)>budget:
        # weld coincident verts first so decimation doesn't tear seams
        q=np.round(V/1e-5).astype(np.int64); _,inv=np.unique(q,axis=0,return_inverse=True); inv=inv.ravel()
        Vw=np.zeros((inv.max()+1,3)); Vw[inv]=V; Fw=inv[F]
        Fw=Fw[(Fw[:,0]!=Fw[:,1])&(Fw[:,1]!=Fw[:,2])&(Fw[:,0]!=Fw[:,2])]
        red=1-budget/len(Fw)
        if red>0.02:
            Vs,Fs=fs.simplify(Vw.astype(np.float32),Fw.astype(np.int32),target_reduction=min(red,0.995),agg=5)
            V,F=Vs.astype(np.float64),Fs.astype(np.int64)
        else: V,F=Vw,Fw
        # disconnected soups (bottle shelves etc.) resist quadric decimation -> vertex clustering fallback:
        # coarsen the clustering grid until the object fits its budget.
        # (only when quadric decimation clearly failed; a 10k-tri plant is better than a 2k-tri spider)
        if len(F)>budget*6.5:
            cell=diag/300
            while len(F)>budget*1.5 and cell<diag/6:
                V,F=cluster(V,F,cell); cell*=1.35
    elif len(F)>budget: pass
    stats['out_tris']+=len(F)
    cats[c].append((to_web(V),F.astype(np.uint32),o['name']))
    if len(F)>1500: print('  heavy',o['name'],len(tri),'->',len(F))

# ---------- GLB writer (positions + indices, one mesh per category)
def pad4(b,fill=b'\0'): return b+fill*((4-len(b)%4)%4)
bin_=bytearray(); views=[]; accs=[]; meshes=[]; nodes=[]
def add_view(data,target):
    off=len(bin_); bin_.extend(pad4(data)); views.append(dict(buffer=0,byteOffset=off,byteLength=len(data),target=target)); return len(views)-1
for cat,items in cats.items():
    if not items: continue
    Vs=[];Fs=[];base=0
    for V,F,_ in items: Vs.append(V); Fs.append(F+base); base+=len(V)
    V=np.concatenate(Vs).astype(np.float32); F=np.concatenate(Fs).astype(np.uint32)
    vi=add_view(V.tobytes(),34962); accs.append(dict(bufferView=vi,componentType=5126,count=len(V),type='VEC3',min=V.min(0).tolist(),max=V.max(0).tolist()))
    ii=add_view(F.tobytes(),34963); accs.append(dict(bufferView=ii,componentType=5125,count=F.size,type='SCALAR'))
    meshes.append(dict(name=cat,primitives=[dict(attributes=dict(POSITION=len(accs)-2),indices=len(accs)-1,mode=4)]))
    nodes.append(dict(name=cat,mesh=len(meshes)-1))
    print(f'{cat:10s} objs={len(items):5d} verts={len(V):8d} tris={len(F):8d}')
gltf=dict(asset=dict(version='2.0',generator='milkyway blend-pipeline'),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],
          nodes=nodes,meshes=meshes,accessors=accs,bufferViews=views,buffers=[dict(byteLength=len(bin_))])
js=pad4(json.dumps(gltf,separators=(',',':')).encode(),b' ')
with open(f'{OUT}/venue-raw.glb','wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_)))
    f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)

# ---------- Surface samples for the particle morph (area-weighted, walls emphasised)
rng=np.random.default_rng(7)
def sample(items,n):
    T=[]
    for V,F,_ in items: T.append(V[F])
    if not T: return np.zeros((0,3),np.float32)
    T=np.concatenate(T); a=np.linalg.norm(np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]),axis=1)*.5
    # soften the area weighting so small props still read as silhouettes
    w=np.sqrt(a)+1e-9; idx=rng.choice(len(T),n,p=w/w.sum())
    u=rng.random((n,1)); v=rng.random((n,1)); m=(u+v)>1; u[m]=1-u[m]; v[m]=1-v[m]
    t=T[idx]; return (t[:,0]+u*(t[:,1]-t[:,0])+v*(t[:,2]-t[:,0])).astype(np.float32)
N=60000
parts=[(sample(cats['wall'],int(N*.38)),0),(sample(cats['furniture'],int(N*.12)),1),(sample(cats['prop'],int(N*.30)),2),(sample(cats['emissive'],int(N*.04)),3)]
# floor outline: points along the hall perimeter on the ground
fmn=to_web(floor['P']).min(0); fmx=to_web(floor['P']).max(0)
nb=int(N*.06); t=rng.random(nb); side=rng.integers(0,4,nb)
fx=np.where(side<2,fmn[0]+t*(fmx[0]-fmn[0]),np.where(side==2,fmn[0],fmx[0]))
fz=np.where(side==0,fmn[2],np.where(side==1,fmx[2],fmn[2]+t*(fmx[2]-fmn[2])))
parts.append((np.stack([fx,np.zeros(nb),fz],1).astype(np.float32),4))
B=to_web(np.array(bulbs)); nbul=N-sum(len(p) for p,_ in parts)
parts.append((B[rng.choice(len(B),nbul)] + rng.normal(0,.15,(nbul,3)).astype(np.float32),5))
P=np.concatenate([p for p,_ in parts]); K=np.concatenate([np.full(len(p),k,np.uint8) for p,k in parts])
perm=rng.permutation(len(P)); P=P[perm]; K=K[perm]   # prefix of a shuffled set = uniform LOD subsample
lo=P.min(0); hi=P.max(0); Q=np.round((P-lo)/(hi-lo)*65535).astype(np.uint16)
with open(f'{OUT}/venue-points.bin','wb') as f:
    f.write(Q.tobytes()); f.write(K.tobytes())
Bq=B.astype(np.float32)
with open(f'{OUT}/venue-bulbs.bin','wb') as f: f.write(Bq.tobytes())

# ---------- wall segments (2D top edges) for the glowing blueprint lines
segs=[]
for V,F,n in cats['wall']:
    mn=V.min(0); mx=V.max(0)
    if (mx[0]-mn[0])>(mx[2]-mn[2]): z=(mn[2]+mx[2])/2; segs.append([float(mn[0]),float(z),float(mx[0]),float(z),float(mx[1])])
    else: x=(mn[0]+mx[0])/2; segs.append([float(x),float(mn[2]),float(x),float(mx[2]),float(mx[1])])
meta=dict(scale=S,centre=[CX,CY],note='world = ((x-cx)*scale, z*scale, -(y-cy)*scale) from Blender coords',
          floor=dict(min=fmn.tolist(),max=fmx.tolist()),
          floorMarks=[[ (m[0]-CX)*S, -(m[3]-CY)*S, (m[2]-CX)*S, -(m[1]-CY)*S ] for m in marks],
          walls=segs,points=dict(count=int(len(P)),min=lo.tolist(),max=hi.tolist(),
          kinds=['wall','furniture','prop','emissive','outline','bulb']),bulbs=int(len(B)),
          stats=dict(src_tris=int(stats['src_tris']),out_tris=int(stats['out_tris']),dropped=dropped))
json.dump(meta,open(f'{OUT}/venue-meta.json','w'),indent=1)
print('src tris',stats['src_tris'],'-> out',stats['out_tris'],'| bulbs',len(B),'| dropped',len(dropped),dropped[:12])
