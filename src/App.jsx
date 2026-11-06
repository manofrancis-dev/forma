import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from 'firebase/auth'
import { addDoc, arrayUnion, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore'
import { Search, ShoppingBag, UserRound, ArrowRight, X, Plus, Minus, Menu, SlidersHorizontal, Sparkles, ShieldCheck, PackageCheck, LogOut, Trash2, LayoutDashboard, CircleUserRound, Heart, Check, ChevronDown } from 'lucide-react'
import { auth, db, isFirebaseConfigured } from './firebase'

const seedProducts = [
  { id:'p1', name:'Easy Day Overshirt', category:'Men', price:1899, oldPrice:2499, color:'Olive / S–XXL', description:'A relaxed cotton overshirt with a soft structure, designed for repeat wear from weekday to weekend.', image:'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=85', badge:'Bestseller', stock:18 },
  { id:'p2', name:'Soft Rib Knit Dress', category:'Women', price:2299, color:'Cocoa / XS–XL', description:'A flattering rib-knit midi with gentle stretch and an effortless everyday silhouette.', image:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85', badge:'New', stock:12 },
  { id:'p3', name:'Weekend Cargo Joggers', category:'Boys', price:1199, oldPrice:1499, color:'Stone / 4–14 years', description:'Hardwearing cotton joggers with roomy pockets and a comfortable drawstring waist.', image:'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=900&q=85', badge:'Limited', stock:9 },
  { id:'p4', name:'Garden Party Co-ord', category:'Girls', price:1599, color:'Blush floral / 4–14 years', description:'A light cotton matching set made for sunny celebrations, playdates and picture days.', image:'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?auto=format&fit=crop&w=900&q=85', badge:'New', stock:14 },
  { id:'p5', name:'Cloud Soft Cotton Set', category:'Kids', price:999, color:'Sky blue / 1–4 years', description:'A breathable two-piece cotton set with a playful shape and room to move.', image:'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=900&q=85', badge:'', stock:25 },
  { id:'p6', name:'Everyday Straight Denim', category:'Women', price:1999, color:'Vintage blue / 26–34', description:'High-rise straight jeans in a midweight denim wash that gets better with every wear.', image:'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85', badge:'', stock:11 },
  { id:'p7', name:'Classic Crew Sweatshirt', category:'Men', price:1499, color:'Oatmeal / S–XXL', description:'A brushed cotton crewneck with a relaxed fit, made for your daily rotation.', image:'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?auto=format&fit=crop&w=900&q=85', badge:'', stock:16 },
  { id:'p8', name:'Mini Adventure Tee Pack', category:'Kids', price:799, color:'Multicolour / 1–4 years', description:'A pack of three soft cotton tees for small adventures and easier morning routines.', image:'https://images.unsplash.com/photo-1519278409-1f56f8f9a2ec?auto=format&fit=crop&w=900&q=85', badge:'Value pack', stock:20 },
]

const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n || 0))
const imageAlt = p => `${p.name}, ${p.category || 'everyday'} fashion by Forma`
const categories = ['All styles','Women','Men','Boys','Girls','Kids']
const CATALOGUE_ID = '_catalogue'
const seedIds = new Set(seedProducts.map(product => product.id))

function catalogueFrom(liveProducts, meta, loaded) {
  const hidden = new Set(meta.hiddenSeedIds || [])
  const byId = new Map(liveProducts.map(product => [product.id, product]))
  const starters = seedProducts
    .filter(product => !hidden.has(product.id))
    .map(product => byId.get(product.id) || (meta.seeded ? null : product))
    .filter(Boolean)
  const extras = liveProducts.filter(product => !seedIds.has(product.id) && !hidden.has(product.id))
  if (!loaded) return seedProducts.filter(product => !hidden.has(product.id))
  return [...starters, ...extras]
}

export default function App() {
  const [user,setUser] = useState(null), [profile,setProfile] = useState(null)
  const [liveProducts,setLiveProducts] = useState([]), [productsLoaded,setProductsLoaded] = useState(!db)
  const [storeMeta,setStoreMeta] = useState({ seeded:false, hiddenSeedIds:[] })
  const [cart,setCart] = useState(()=>{try{return JSON.parse(localStorage.getItem('forma-cart')||'[]')}catch{return []}})
  const [wishlist,setWishlist] = useState(()=>{try{return JSON.parse(localStorage.getItem('forma-wishlist')||'[]')}catch{return []}})
  const [modal,setModal] = useState(''), [drawer,setDrawer] = useState(''), [authMode,setAuthMode] = useState('login')
  const [activeCategory,setActiveCategory] = useState('All styles'), [search,setSearch] = useState(''), [sort,setSort] = useState('featured')
  const [selected,setSelected] = useState(null), [notice,setNotice] = useState(''), [mobileMenu,setMobileMenu] = useState(false)
  const [orders,setOrders] = useState([]), [adminTab,setAdminTab] = useState('Overview'), [loading,setLoading] = useState(false)
  const seedStarted = useRef(false)
  const products = useMemo(()=>catalogueFrom(liveProducts, storeMeta, productsLoaded),[liveProducts, storeMeta, productsLoaded])

  useEffect(()=>{localStorage.setItem('forma-cart',JSON.stringify(cart))},[cart])
  useEffect(()=>{localStorage.setItem('forma-wishlist',JSON.stringify(wishlist))},[wishlist])
  useEffect(()=>{
    setCart(current=>{
      let changed=false
      const next=current.map(item=>{
        const live=products.find(product=>product.id===item.id)
        if(!live || (live.price===item.price && live.name===item.name && live.image===item.image && live.stock===item.stock)) return item
        changed=true
        return {...item, price:live.price, name:live.name, image:live.image, stock:live.stock, color:live.color}
      })
      return changed ? next : current
    })
  },[products])
  useEffect(()=>{
    setWishlist(current=>{
      let changed=false
      const next=current.map(item=>{
        const live=products.find(product=>product.id===item.id)
        if(!live || (live.price===item.price && live.name===item.name && live.image===item.image)) return item
        changed=true
        return {...item, price:live.price, name:live.name, image:live.image, color:live.color, category:live.category}
      })
      return changed ? next : current
    })
  },[products])
  useEffect(()=>{
    if(!auth || !db) return
    let unsubProfile=()=>{}
    const unsubAuth=onAuthStateChanged(auth, async current=>{
      unsubProfile()
      unsubProfile=()=>{}
      if(!current){setUser(null);setProfile(null);return}
      if(!current.emailVerified){await signOut(auth);setUser(null);setProfile(null);return}
      setUser(current)
      const userRef=doc(db,'users',current.uid)
      unsubProfile=onSnapshot(userRef, async snap=>{
        if(snap.exists()){setProfile(snap.data());return}
        try{await setDoc(userRef,{name:current.displayName||'Customer',email:current.email,role:'customer',createdAt:serverTimestamp()})}
        catch(err){setNotice(err.message)}
      },()=>setProfile(null))
    })
    return ()=>{unsubProfile();unsubAuth()}
  },[])
  useEffect(()=>{
    if(!db) return
    return onSnapshot(collection(db,'products'),snap=>{
      const docs=snap.docs.map(d=>({id:d.id,...d.data()}))
      const config=docs.find(product=>product.id===CATALOGUE_ID)
      setStoreMeta({ seeded:Boolean(config?.seeded), hiddenSeedIds:config?.hiddenSeedIds||[] })
      setLiveProducts(docs.filter(product=>product.id!==CATALOGUE_ID && product.name))
      setProductsLoaded(true)
    },()=>setProductsLoaded(true))
  },[])
  useEffect(()=>{
    if(!db || profile?.role!=='admin' || storeMeta.seeded || seedStarted.current) return
    seedStarted.current=true
    ;(async()=>{
      try{
        const snap=await getDocs(collection(db,'products'))
        const ids=new Set(snap.docs.map(d=>d.id))
        const config=snap.docs.find(d=>d.id===CATALOGUE_ID)?.data()||{}
        if(config.seeded) return
        const hidden=new Set(config.hiddenSeedIds||[])
        const batch=writeBatch(db)
        seedProducts.forEach(seed=>{
          if(ids.has(seed.id) || hidden.has(seed.id)) return
          const {id,...data}=seed
          batch.set(doc(db,'products',id), data)
        })
        batch.set(doc(db,'products',CATALOGUE_ID),{seeded:true, hiddenSeedIds:[...hidden]},{merge:true})
        await batch.commit()
      }catch(err){
        seedStarted.current=false
        setNotice(`Could not sync the catalogue: ${err.message}`)
      }
    })()
  },[profile, storeMeta.seeded])
  useEffect(()=>{
    if(!db || !user || !profile) { setOrders([]); return }
    const source = profile.role==='admin'
      ? query(collection(db,'orders'),orderBy('createdAt','desc'))
      : query(collection(db,'orders'),where('uid','==',user.uid))
    return onSnapshot(source,snap=>{
      const next=snap.docs.map(d=>({id:d.id,...d.data()}))
      next.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      setOrders(next)
    },()=>setOrders([]))
  },[profile,user])
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t)},[notice])

  const filtered=useMemo(()=>{
    let list=products.filter(p=>(activeCategory==='All styles'||p.category===activeCategory)&&`${p.name} ${p.category} ${p.color||''}`.toLowerCase().includes(search.toLowerCase()))
    if(sort==='price-low')list=[...list].sort((a,b)=>a.price-b.price)
    if(sort==='price-high')list=[...list].sort((a,b)=>b.price-a.price)
    if(sort==='newest')list=[...list].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    return list
  },[products,activeCategory,search,sort])
  const cartCount=cart.reduce((n,i)=>n+i.qty,0), subtotal=cart.reduce((n,i)=>n+i.price*i.qty,0), shippingFee=subtotal>=2999?0:99
  const wishlistIds=useMemo(()=>new Set(wishlist.map(item=>item.id)),[wishlist])
  function toggleWishlist(p){
    const saved=wishlistIds.has(p.id)
    setWishlist(list=>saved?list.filter(item=>item.id!==p.id):[...list,{id:p.id,name:p.name,price:p.price,image:p.image,color:p.color,category:p.category}])
    setNotice(saved?'Removed from your wishlist':'Saved to your wishlist')
  }
  const addToCart=(p)=>{
    const inBag=cart.find(i=>i.id===p.id)?.qty||0
    if(Number.isFinite(Number(p.stock)) && inBag>=Number(p.stock)){setNotice(inBag?'That’s all we have in stock':'This piece is sold out');return}
    setCart(c=>{const found=c.find(i=>i.id===p.id);return found?c.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...c,{...p,qty:1}]})
    setNotice('Added to your bag');setDrawer('cart')
  }
  const adjust=(id,delta)=>setCart(c=>c.map(i=>{
    if(i.id!==id) return i
    const next=i.qty+delta
    if(delta>0 && Number.isFinite(Number(i.stock)) && next>Number(i.stock)) return i
    return {...i,qty:next}
  }).filter(i=>i.qty>0))

  async function handleAuth(e){e.preventDefault();if(!isFirebaseConfigured){setNotice('Add your Firebase credentials to .env.local first');return}setLoading(true);const fd=new FormData(e.currentTarget);const email=fd.get('email'),password=fd.get('password');try{
    if(authMode==='signup'){
      const name=fd.get('name');const cred=await createUserWithEmailAndPassword(auth,email,password)
      await updateProfile(cred.user,{displayName:name})
      await sendEmailVerification(cred.user)
      await signOut(auth)
      setNotice('Verification link sent. Check your email, verify it, then sign in.')
      setModal('')
    } else {
      const cred=await signInWithEmailAndPassword(auth,email,password)
      if(!cred.user.emailVerified){
        await sendEmailVerification(cred.user)
        await signOut(auth)
        setNotice('Please verify your email first. We sent a fresh verification link.')
        setModal('')
        return
      }
      setNotice('Welcome back');setModal('')
    }
  }catch(err){setNotice(err.code?.includes('email-already')?'An account already exists for this email':err.code?.includes('invalid-credential')?'Email or password is incorrect':err.message)}finally{setLoading(false)}}

  function beginCheckout(){
    if(!user){setDrawer('');setAuthMode('login');setModal('auth');setNotice('Sign in to continue to checkout');return}
    if(!cart.length)return
    setDrawer('');setModal('checkout')
  }
  async function checkout(e){e.preventDefault();if(!cart.length)return;setLoading(true);const f=new FormData(e.currentTarget);const customer=f.get('customer').trim();const phone=f.get('phone').trim();try{
    await addDoc(collection(db,'orders'),{uid:user.uid,email:user.email,customer,phone,shippingAddress:{line1:f.get('line1').trim(),line2:f.get('line2').trim(),city:f.get('city').trim(),state:f.get('state').trim(),pincode:f.get('pincode').trim()},items:cart.map(({id,name,price,qty,image})=>({id,name,price,qty,image})),subtotal,shipping:shippingFee,total:subtotal+shippingFee,status:'Processing',createdAt:serverTimestamp()})
    setCart([]);setModal('success')
  }catch(err){setNotice(`Could not place order: ${err.message}`)}finally{setLoading(false)}}

  async function saveProduct(e){e.preventDefault();const f=new FormData(e.currentTarget);const data={name:f.get('name'),category:f.get('category'),price:Number(f.get('price')),stock:Number(f.get('stock')),image:f.get('image'),color:f.get('color')||'',description:f.get('description')||'',badge:f.get('badge')||''};if(selected?.oldPrice)data.oldPrice=Number(selected.oldPrice);try{if(selected?.id)await setDoc(doc(db,'products',selected.id),data,{merge:true});else await addDoc(collection(db,'products'),{...data,createdAt:serverTimestamp()});setModal('');setSelected(null);setNotice('Product saved')}catch(err){setNotice(`Could not save: ${err.message}`)}}
  async function removeProduct(id){try{await deleteDoc(doc(db,'products',id));if(seedIds.has(id))await setDoc(doc(db,'products',CATALOGUE_ID),{seeded:true,hiddenSeedIds:arrayUnion(id)},{merge:true});setNotice('Product removed')}catch(e){setNotice(e.message)}}
  const admin=profile?.role==='admin'

  return <div className="app-shell">
    <div className="announcement"><span>Everyday style, made to move with you.</span><span className="announcement-right">Complimentary shipping on orders over ₹2,999 <ArrowRight size={13}/></span></div>
    <header className="header">
      <button className="icon-button mobile-only" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21}/></button>
      <a href="#top" className="wordmark">forma<span>.</span></a>
      <nav className={mobileMenu?'nav open':'nav'}>{categories.map(c=><button key={c} className={activeCategory===c?'nav-link active':'nav-link'} onClick={()=>{setActiveCategory(c);setMobileMenu(false);document.getElementById('shop')?.scrollIntoView({behavior:'smooth'})}}>{c}</button>)}</nav>
      <div className="header-actions"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);document.getElementById('shop')?.scrollIntoView({behavior:'smooth'})}} placeholder="Search pieces"/></label><button className="icon-button account-action" aria-label="Account" onClick={()=>admin?setDrawer('admin'):user?setDrawer('account'):(setAuthMode('login'),setModal('auth'))}><UserRound size={19}/></button><button className="bag-button" onClick={()=>{if(!user){setAuthMode('login');setModal('auth');setNotice('Sign in to see your orders');return} if(admin){setAdminTab('Orders');setDrawer('admin');return} setDrawer('orders')}} aria-label="Orders"><PackageCheck size={18}/><span>Orders</span>{user&&orders.length>0&&<b>{orders.length}</b>}</button><button className="bag-button wishlist-button" onClick={()=>setDrawer('wishlist')} aria-label="Wishlist"><Heart size={18}/><span>Wishlist</span><b>{wishlist.length}</b></button><button className="bag-button" onClick={()=>setDrawer('cart')}><ShoppingBag size={18}/><span>Bag</span><b>{cartCount}</b></button></div>
    </header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> STYLE FOR EVERY DAY</div><h1>Wear what<br/><em>feels like you.</em></h1><p>Easy essentials and joyful layers for women, men and little ones. Made for the real, everyday moments.</p><button className="dark-button" onClick={()=>document.getElementById('shop').scrollIntoView({behavior:'smooth'})}>Shop new arrivals <ArrowRight size={16}/></button><div className="hero-footnote"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span></div><span>Worn by <strong>24,000+</strong> happy customers</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1500&q=90" alt="Forma everyday fashion collection, designed by Mano Francis Dev"/><div className="image-caption"><span>THE DAILY EDIT</span><span>01 / 03</span></div><div className="hero-stamp"><Sparkles size={17}/><span>Style for<br/>real life</span></div></div></section>
      <section className="promise-strip"><div><PackageCheck/><span>Made with intention</span></div><div><ShieldCheck/><span>Thoughtful materials</span></div><div><Heart/><span>Pieces to keep</span></div><div><Sparkles/><span>Small-batch & special</span></div></section>
      <section id="shop" className="shop-section"><div className="section-heading"><div><div className="eyebrow">THE DAILY COLLECTION</div><h2>Everyday style, <em>made easy.</em></h2></div><p>Clothes for every age and every kind of day.<br/>Find the pieces that feel like you.</p></div><div className="collection-toolbar"><div className="category-pills">{categories.map(c=><button key={c} className={activeCategory===c?'pill active':'pill'} onClick={()=>setActiveCategory(c)}>{c}</button>)}</div><label className="sort-select"><SlidersHorizontal size={15}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={14}/></label></div>
      <div className="product-grid">{filtered.map((p,i)=><article className="product-card" key={p.id}><div className="product-image-wrap"><button className="product-image" onClick={()=>{setSelected(p);setModal('product')}}><img src={p.image} alt={imageAlt(p)} loading="lazy"/><span className="quick-view">Quick view <ArrowRight size={14}/></span></button>{p.badge&&<span className="product-badge">{p.badge}</span>}<button className={wishlistIds.has(p.id)?'heart-button liked':'heart-button'} onClick={()=>toggleWishlist(p)} aria-pressed={wishlistIds.has(p.id)} aria-label={wishlistIds.has(p.id)?`Remove ${p.name} from wishlist`:`Save ${p.name} to wishlist`}><Heart size={17}/></button><button className="quick-add" onClick={()=>addToCart(p)} aria-label={`Add ${p.name} to bag`}><Plus size={18}/></button></div><div className="product-info"><div><span className="product-category">{p.category}</span><h3>{p.name}</h3><span className="product-color">{p.color}</span></div><div className="product-price">{money(p.price)}{p.oldPrice&&<del>{money(p.oldPrice)}</del>}</div></div></article>)}</div>{filtered.length===0&&<div className="empty-state">No pieces found. Try another search.</div>}
      <div className="collection-bottom"><span>Showing {filtered.length} of {products.length} everyday favourites</span><button onClick={()=>{setActiveCategory('All styles');setSearch('')}}>View all styles <ArrowRight size={15}/></button></div></section>
      <section className="story"><div className="story-image"><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=85" alt="Everyday fashion portrait for Forma by Mano Francis Dev"/><div className="story-tag">MORE YOU,<br/><em>EVERY DAY.</em></div></div><div className="story-copy"><div className="eyebrow">A NOTE FROM FORMA</div><h2>Good style<br/>feels <em>natural.</em></h2><p>We choose comfortable fabrics, easy silhouettes and everyday colours for wardrobes that work harder and last longer.</p><p>For every body, every age, every ordinary day made better.</p><button className="text-link" onClick={()=>setNotice('Our story is coming soon')}>A little more about us <ArrowRight size={16}/></button><div className="story-signature">made for every day, <span>forma</span></div></div></section>
      <section className="newsletter"><div className="eyebrow">A LETTER, OCCASIONALLY</div><h2>Good things, <em>in good time.</em></h2><p>New arrivals, quiet inspiration, and 10% off your first order.</p><form onSubmit={e=>{e.preventDefault();setNotice('You’re on the list — see you in your inbox!');e.currentTarget.reset()}}><input type="email" required placeholder="Your email address" aria-label="Email address"/><button aria-label="Subscribe"><ArrowRight size={18}/></button></form><small>By subscribing, you agree to receive occasional emails from Forma.</small><div className="newsletter-flower">✳</div></section>
    </main>
    <footer className="footer"><div className="footer-brand"><a href="#top" className="wordmark">forma<span>.</span></a><p>Everyday fashion,<br/>chosen with intention.</p><div className="socials"><a href="https://github.com/manofrancis-dev" target="_blank" rel="noopener noreferrer" aria-label="GitHub">Gh</a><a href="https://in.linkedin.com/in/manofrancis-dev" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">In</a><a href="https://manofrancis-dev.github.io/manofrancis-portfolio/" target="_blank" rel="noopener noreferrer" aria-label="Portfolio">Pf</a></div></div><div className="footer-col"><b>Shop</b><a href="#shop">Women</a><a href="#shop">Men</a><a href="#shop">Kids</a></div><div className="footer-col"><b>We’re here</b><a href="mailto:hello@forma.example">Contact us</a><a href="#shipping">Shipping & returns</a><a href="#care">Size guide</a></div><div className="footer-col"><b>The fine print</b><a href="#privacy">Privacy policy</a><a href="#terms">Terms of service</a><a href="#accessibility">Accessibility</a></div><div className="footer-bottom"><span>© 2026 Forma. Everyday fashion.</span><p className="designer-credit">Designed by <a href="https://manofrancis-dev.github.io/manofrancis-portfolio/" target="_blank" rel="noopener noreferrer">Mano Francis Dev</a><a href="https://manofrancis-dev.github.io/manofrancis-portfolio/" target="_blank" rel="noopener noreferrer">Portfolio</a><a href="https://in.linkedin.com/in/manofrancis-dev" target="_blank" rel="noopener noreferrer">LinkedIn</a><a href="https://github.com/manofrancis-dev" target="_blank" rel="noopener noreferrer">GitHub</a></p></div></footer>

    {notice&&<div className="toast"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    {modal==='auth'&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal('')}><div className="auth-modal"><button className="close-button" onClick={()=>setModal('')}><X/></button><div className="eyebrow">WELCOME TO FORMA</div><h2>{authMode==='login'?'A good place to return.':'Make yourself at home.'}</h2><p>{authMode==='login'?'Sign in to see your orders and saved pieces.':'Create an account for a more personal experience.'}</p>{authMode==='signup'&&<div className="verification-note"><ShieldCheck size={15}/> We’ll send a verification link. Your account works only after you verify the email.</div>}{!isFirebaseConfigured&&<div className="config-note">Firebase isn’t connected yet. Add the credentials in <code>.env.local</code> and restart the app.</div>}<form onSubmit={handleAuth}>{authMode==='signup'&&<label>Your name<input name="name" required placeholder="Name"/></label>}<label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="email"/></label><label>Password<input name="password" type="password" minLength="6" required placeholder="At least 6 characters" autoComplete={authMode==='signup'?'new-password':'current-password'}/></label><button className="dark-button full-button" disabled={loading}>{loading?'Please wait…':authMode==='login'?'Sign in':'Create account'} <ArrowRight size={16}/></button></form><div className="auth-switch">{authMode==='login'?<>New to Forma? <button onClick={()=>setAuthMode('signup')}>Create an account</button></>:<>Already have an account? <button onClick={()=>setAuthMode('login')}>Sign in</button></>}</div></div></div>}
    {modal==='checkout'&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal('')}><div className="checkout-modal"><button className="close-button" onClick={()=>setModal('')}><X/></button><div className="eyebrow">SECURE CHECKOUT</div><h2>Where should we<br/>send your order?</h2><p>Enter your delivery details. Your order status will be available in your account.</p><form onSubmit={checkout}><label>Full name<input name="customer" required defaultValue={profile?.name||user?.displayName||''} placeholder="Your full name"/></label><div className="form-row"><label>Phone number<input name="phone" type="tel" required pattern="[0-9+() -]{8,}" placeholder="10-digit mobile number"/></label><label>Pincode<input name="pincode" required pattern="[0-9]{6}" inputMode="numeric" placeholder="6-digit pincode"/></label></div><label>Address<input name="line1" required placeholder="House / flat number, street"/></label><label>Area / landmark <span className="optional">Optional</span><input name="line2" placeholder="Area, locality or landmark"/></label><div className="form-row"><label>City<input name="city" required placeholder="City"/></label><label>State<input name="state" required placeholder="State"/></label></div><div className="checkout-total"><span>Order total</span><b>{money(subtotal+shippingFee)}</b></div><button className="dark-button full-button" disabled={loading}>{loading?'Placing your order…':'Place order'} <ArrowRight size={16}/></button></form></div></div>}
    {modal==='success'&&<div className="modal-backdrop"><div className="success-modal"><div className="success-icon"><Check/></div><div className="eyebrow">ORDER PLACED</div><h2>Thank you. <em>Truly.</em></h2><p>Your order is in good hands. Track each delivery update from Orders.</p><button className="dark-button" onClick={()=>setModal('')}>Keep exploring <ArrowRight size={16}/></button></div></div>}
    {modal==='product'&&selected&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal('')}><div className="product-modal"><button className="close-button" onClick={()=>setModal('')}><X/></button><img src={selected.image} alt={imageAlt(selected)}/><div><div className="eyebrow">{selected.category}</div><h2>{selected.name}</h2><div className="modal-price">{money(selected.price)}</div><p>{selected.description}</p><span className="product-color">{selected.color}</span><button className="dark-button full-button" onClick={()=>{addToCart(selected);setModal('')}}>Add to bag <ArrowRight size={16}/></button><button className="text-link wishlist-save" onClick={()=>toggleWishlist(selected)}>{wishlistIds.has(selected.id)?'Saved to wishlist':'Save to wishlist'} <Heart size={15}/></button><small>Complimentary shipping over ₹2,999</small></div></div></div>}
    {modal==='product-edit'&&admin&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&(setModal(''),setSelected(null))}><div className="edit-modal"><button className="close-button" onClick={()=>{setModal('');setSelected(null)}}><X/></button><div className="eyebrow">{selected?.id?'UPDATE THE COLLECTION':'ADD TO THE COLLECTION'}</div><h2>{selected?.id?'Edit piece':'New piece'}</h2><form onSubmit={saveProduct}><label>Product name<input name="name" required defaultValue={selected?.name}/></label><div className="form-row"><label>Category<select name="category" defaultValue={selected?.category||'Women'}>{categories.filter(c=>c!=='All styles').map(c=><option key={c}>{c}</option>)}</select></label><label>Price (₹)<input name="price" type="number" min="0" step="1" required defaultValue={selected?.price}/></label></div><label>Image URL<input name="image" type="url" required defaultValue={selected?.image} placeholder="https://…"/></label><label>Colour / size<input name="color" defaultValue={selected?.color}/></label><div className="form-row"><label>Stock<input name="stock" type="number" min="0" defaultValue={selected?.stock||0}/></label><label>Badge<input name="badge" defaultValue={selected?.badge}/></label></div><label>Description<textarea name="description" rows="3" defaultValue={selected?.description}/></label><button className="dark-button full-button">Save piece <ArrowRight size={16}/></button></form></div></div>}
    {drawer&&<div className="drawer-layer" onMouseDown={e=>e.target===e.currentTarget&&setDrawer('')}><aside className={drawer==='admin'?'drawer admin-drawer':'drawer'}><div className="drawer-head"><div><div className="eyebrow">{drawer==='cart'?'YOUR SELECTION':drawer==='wishlist'?'SAVED FOR LATER':drawer==='orders'?'LIVE UPDATES':drawer==='admin'?'FORMA STUDIO':'YOUR ACCOUNT'}</div><h2>{drawer==='cart'?'Your bag':drawer==='wishlist'?'Your wishlist':drawer==='orders'?'Your orders':drawer==='admin'?'Admin studio':'Welcome back'}</h2></div><button className="icon-button" onClick={()=>setDrawer('')}><X/></button></div>
      {drawer==='cart'&&<><div className="cart-items">{cart.length===0?<div className="cart-empty"><ShoppingBag size={32}/><h3>Nothing here, yet.</h3><p>Find a look they’ll love to wear.</p><button className="text-link" onClick={()=>{setDrawer('');document.getElementById('shop').scrollIntoView({behavior:'smooth'})}}>Explore the collection <ArrowRight size={15}/></button></div>:cart.map(i=><div className="cart-item" key={i.id}><img src={i.image} alt={imageAlt(i)}/><div className="cart-item-info"><h3>{i.name}</h3><span>{i.color}</span><b>{money(i.price)}</b><div className="qty-control"><button onClick={()=>adjust(i.id,-1)}><Minus size={13}/></button><span>{i.qty}</span><button onClick={()=>adjust(i.id,1)}><Plus size={13}/></button></div></div><button className="remove-item" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}><Trash2 size={15}/></button></div>)}</div>{cart.length>0&&<div className="cart-summary"><div className="shipping-progress"><span>{shippingFee===0?'You’ve unlocked complimentary shipping':'You’re '+money(2999-subtotal)+' away from complimentary shipping'}</span><div><i style={{width:`${Math.min(subtotal/2999*100,100)}%`}}/></div></div><div className="summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="summary-line muted"><span>Shipping</span><span>{shippingFee===0?'Complimentary':money(shippingFee)}</span></div><button className="dark-button checkout-button" disabled={loading} onClick={beginCheckout}>{`Continue · ${money(subtotal+shippingFee)}`} <ArrowRight size={16}/></button><small>Taxes calculated at checkout. Secure checkout.</small></div>}</>}
      {drawer==='wishlist'&&<div className="cart-items">{wishlist.length===0?<div className="cart-empty"><Heart size={32}/><h3>Nothing saved yet.</h3><p>Tap the heart on a piece to keep it here.</p><button className="text-link" onClick={()=>{setDrawer('');document.getElementById('shop').scrollIntoView({behavior:'smooth'})}}>Explore the collection <ArrowRight size={15}/></button></div>:wishlist.map(i=><div className="cart-item" key={i.id}><img src={i.image} alt={imageAlt(i)}/><div className="cart-item-info"><h3>{i.name}</h3><span>{i.color}</span><b>{money(i.price)}</b><button className="text-link" onClick={()=>{const live=products.find(product=>product.id===i.id)||i;addToCart(live)}}>Add to bag <ArrowRight size={14}/></button></div><button className="remove-item" onClick={()=>toggleWishlist(i)} aria-label={`Remove ${i.name} from wishlist`}><Trash2 size={15}/></button></div>)}</div>}
      {drawer==='orders'&&<div className="account-panel orders-panel"><div className="account-orders-head"><PackageCheck/> <span>Your orders</span><small>LIVE</small></div>{orders.length===0?<div className="cart-empty"><PackageCheck size={32}/><h3>No orders yet.</h3><p>When you place an order, its status updates here.</p><button className="text-link" onClick={()=>{setDrawer('');document.getElementById('shop')?.scrollIntoView({behavior:'smooth'})}}>Explore the collection <ArrowRight size={15}/></button></div>:orders.map(o=><div className="account-order" key={o.id}><div><b>Order #{o.id.slice(-6).toUpperCase()}</b><span>{o.items?.map(i=>`${i.name} ×${i.qty}`).join(', ')}</span><strong>{money(o.total||o.subtotal)}</strong></div><span className="status-tag">{o.status||'Processing'}</span></div>)}</div>}
      {drawer==='account'&&<div className="account-panel"><div className="account-avatar"><CircleUserRound/></div><h3>{profile?.name||user?.displayName||'Forma customer'}</h3><p>{user?.email}</p><button className="account-row" onClick={()=>setDrawer('orders')}><PackageCheck/> Your orders <ArrowRight/></button><button className="account-row" onClick={()=>{signOut(auth);setDrawer('')}}><LogOut/> Sign out <ArrowRight/></button></div>}
      {drawer==='admin'&&admin&&<AdminPanel tab={adminTab} setTab={setAdminTab} products={products} orders={orders} onEdit={p=>{setSelected(p);setDrawer('');setModal('product-edit')}} onDelete={removeProduct} onAdd={()=>{setSelected(null);setDrawer('');setModal('product-edit')}} onStatus={async(o,status)=>{try{await updateDoc(doc(db,'orders',o.id),{status});setNotice('Order updated')}catch(e){setNotice(e.message)}}} onLogout={()=>{signOut(auth);setDrawer('')}} user={user}/>}
    </aside></div>}
  </div>
}

function AdminPanel({tab,setTab,products,orders,onEdit,onDelete,onAdd,onStatus,onLogout,user}){
  const revenue=orders.reduce((n,o)=>n+Number(o.total||o.subtotal||0),0)
  const packed=orders.filter(o=>['Packed','Shipped'].includes(o.status)).length
  const address=o=>[o.shippingAddress?.line1,o.shippingAddress?.line2,o.shippingAddress?.city,o.shippingAddress?.state,o.shippingAddress?.pincode].filter(Boolean).join(', ')
  return <div className="wordpress-admin"><aside className="wp-sidebar"><div className="wp-site">forma<span>.</span> <small>ADMIN</small></div>{[['Overview',LayoutDashboard],['Orders',ShoppingBag],['Products',PackageCheck]].map(([name,Icon])=><button key={name} className={tab===name?'selected':''} onClick={()=>setTab(name)}><Icon size={16}/>{name}{name==='Orders'&&orders.length>0&&<b>{orders.length}</b>}</button>)}<div className="wp-admin-user"><CircleUserRound size={18}/><span>{user?.email}</span></div><button className="wp-logout" onClick={onLogout}><LogOut size={16}/>Log out</button></aside><section className="admin-main">
    <div className="admin-main-head"><div><div className="eyebrow">FORMA STORE MANAGEMENT</div><h3>{tab}</h3></div>{tab==='Products'&&<button className="wp-primary" onClick={onAdd}><Plus size={15}/> Add product</button>}</div>
    {tab==='Overview'&&<><div className="admin-welcome"><b>Welcome back.</b><span>Live store activity and fulfilment in one place.</span></div><div className="stat-grid"><div><span>Gross sales</span><b>{money(revenue)}</b><small>All time</small></div><div><span>Orders</span><b>{orders.length}</b><small>All time</small></div><div><span>To fulfil</span><b>{packed}</b><small>Packed or shipped</small></div><div><span>Products</span><b>{products.length}</b><small>In catalogue</small></div></div><div className="admin-section-title">Recent orders <span>LIVE</span></div>{orders.slice(0,5).map(o=><div className="admin-order" key={o.id}><div><b>#{o.id.slice(-6).toUpperCase()} · {o.customer||o.email}</b><span>{o.items?.length||0} items · {money(o.total||o.subtotal)}</span></div><span className="status-tag">{o.status||'Processing'}</span></div>)}{orders.length===0&&<div className="admin-empty">Incoming orders appear here in real time.</div>}</>}
    {tab==='Products'&&<><div className="admin-section-title">Catalogue <span>{products.length} PRODUCTS</span></div>{products.map(p=><div className="admin-product" key={p.id}><img src={p.image} alt={imageAlt(p)}/><div><b>{p.name}</b><span>{p.category} · {money(p.price)} · {p.stock||0} in stock</span></div><button onClick={()=>onEdit(p)}>Edit</button><button className="admin-delete" onClick={()=>onDelete(p.id)} aria-label="Delete product"><Trash2 size={15}/></button></div>)}</>}
    {tab==='Orders'&&<><div className="admin-section-title">Orders <span>{orders.length} TOTAL</span></div>{orders.map(o=><article className="admin-order full-order" key={o.id}><div><b>#{o.id.slice(-6).toUpperCase()} · {o.customer||o.email}</b><span>{o.email} · {o.phone||'Phone not provided'} · {money(o.total||o.subtotal)}</span><span>{o.items?.map(i=>`${i.name} ×${i.qty}`).join(', ')}</span>{address(o)&&<div className="delivery-address"><strong>Delivery address</strong>{address(o)}</div>}</div><select value={o.status||'Processing'} onChange={e=>onStatus(o,e.target.value)}>{['Processing','Packed','Shipped','Delivered','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></article>)}{!orders.length&&<div className="admin-empty">No orders yet. Placed orders appear here as they happen.</div>}</>}
  </section></div>
}
