import{r as n}from"./index-C3--GnAp.js";import{s as i}from"./supabase-KAXpo3yM.js";import{u as p}from"./authStore-Cz-qJVyn.js";const S=()=>{const[c,u]=n.useState([]),[l,d]=n.useState(!1),{user:t}=p(),a=async()=>{if(t){d(!0);try{const{data:e,error:r}=await i.from("cart_items").select(`
          id,
          sheet_id,
          created_at,
          drum_sheets (
            id,
            title,
            artist,
            price,
            thumbnail_url,
            category_id,
            categories (
              name
            )
          )
        `).eq("user_id",t.id);if(r)throw r;const o=e?.filter(s=>s.drum_sheets).map(s=>({id:s.id,sheet_id:s.sheet_id,title:s.drum_sheets.title,artist:s.drum_sheets.artist,price:s.drum_sheets.price,image:s.drum_sheets.thumbnail_url,category:s.drum_sheets.categories?.name||"기타"}))||[];u(o)}catch(e){console.error("장바구니 로드 실패:",e)}finally{d(!1)}}},f=async e=>{if(!t)return alert("로그인이 필요합니다."),!1;try{const{error:r}=await i.from("cart_items").insert({user_id:t.id,sheet_id:e});if(r){if(r.code==="23505")return alert("이미 장바구니에 있는 상품입니다."),!1;throw r}return await a(),!0}catch(r){return console.error("장바구니 추가 실패:",r),alert("장바구니 추가에 실패했습니다."),!1}},m=async e=>{if(!t)return!1;try{const{error:r}=await i.from("cart_items").delete().eq("id",e).eq("user_id",t.id);if(r)throw r;return await a(),!0}catch(r){return console.error("장바구니 제거 실패:",r),!1}},h=async e=>{if(!t||e.length===0)return!1;try{const{error:r}=await i.from("cart_items").delete().in("id",e).eq("user_id",t.id);if(r)throw r;return await a(),!0}catch(r){return console.error("선택 아이템 제거 실패:",r),!1}},_=async()=>{if(!t)return!1;try{const{error:e}=await i.from("cart_items").delete().eq("user_id",t.id);if(e)throw e;return u([]),!0}catch(e){return console.error("장바구니 비우기 실패:",e),!1}},w=e=>c.some(r=>r.sheet_id===e),y=e=>(e?c.filter(o=>e.includes(o.id)):c).reduce((o,s)=>o+s.price,0);return n.useEffect(()=>{a()},[t]),{cartItems:c,loading:l,addToCart:f,removeFromCart:m,removeSelectedItems:h,clearCart:_,isInCart:w,getTotalPrice:y,loadCartItems:a}};export{S as u};
//# sourceMappingURL=useCart-LIK69JhF.js.map
