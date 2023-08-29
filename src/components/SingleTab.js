import React, { useEffect, useState } from 'react';
import ImageUploading from 'react-images-uploading';
import { sleep, base64ToArrayBuffer } from '../services/helpers';
import { NFTStorage, File, Token } from 'nft.storage'
import { ipfskey, sauceInu } from '../config/config';
import { createNFT, approveSauceInu, getTokenAddress, mintNFT, createNFTWithFees, associateToken, shouldApprove,createTokenWithJs } from '../hashgraph';
import { TokenId, AccountId, CustomFixedFee, Hbar, CustomRoyaltyFee, TokenCreateTransaction, TokenType, TokenSupplyType } from '@hashgraph/sdk';
import { Oval } from  'react-loader-spinner'


function SingleTab({pairingData}) {
    const [images, setImages] = useState([]);
    const [description, setDescription] = useState(undefined);
    const [creator, setCreator] = useState(undefined);
    const [quantity, setQuantity] = useState(undefined);
    const [maxSupply, setMaxSupply] = useState(undefined);
    const [tokenName, setTokenName] = useState(undefined);
    const [symbol, setSymbol] = useState(undefined);
    const [fallbackFee, setFallbackFee] = useState(undefined);
    const [numRoyaltyAccs, setNumRoyaltyAccs] = useState(undefined);
    const [numAttributes, setNumAttributes] = useState(undefined);
    const [royaltyAccs, setRoyaltyAccs] = useState([]);
    const [attributes, setAttributes] = useState([]);
    const [step, setStep] = useState(0);
    const [buttonTxt, setButtonTxt] = useState(["CREATE & MINT", "CREATING NFT...", "ASSOCIATE NFT", "ASSOCIATING NFT...", "APPROVE SAUCEINU", "APPROVING SAUCEINU...", "MINT", "MINTING..."])
    const [errorMsg, setErrorMsg] = useState("");
    const [createdToken, setCreatedToken] = useState(undefined);
    const [metadata, setMetadata] = useState(undefined);
    const onChange = (imageList) => {
        setImages(imageList);
    };
    const updateNumAttributes = (value) => {
        if(parseInt(value)<0) return;
        setNumAttributes(value);
        let newArr = new Array(parseInt(value)).fill({trait_type:"", value: ""});
        setAttributes(newArr);
    }
    const updateAttributes = (index, type, value) => {
        const newValues = attributes.map((item, i) => {
            return i === index ? type=="trait_type"?{trait_type: value, value: item.value}:{trait_type: item.trait_type, value: value} : item;
        });
        setAttributes(newValues);
    }
    const updateNumRoyaltyAccs = (value) => {
        if(parseInt(value)<0) return;
        setNumRoyaltyAccs(value);
        let newArr = new Array(parseInt(value)).fill({royalty_account:"", fee: ""});
        setRoyaltyAccs(newArr);
    }
    const updateRoyaltyAccs = (index, type, value) => {
        const newValues = royaltyAccs.map((item, i) => {
            return i === index ? type=="royalty_account"?{royalty_account: value, fee: item.value}:{royalty_account: item.royalty_account, fee: value} : item;
        });
        setRoyaltyAccs(newValues);
    }
    
    const createNFTFunc = async () => {
        if(images.length==0) { setErrorMsg("please select image"); return; }
        if(tokenName==undefined || symbol==undefined || maxSupply==undefined) { setErrorMsg("Please enter required fields"); return; }
        if(maxSupply<quantity) { setErrorMsg("Quentity exceeded the max supply"); return;}
        try {
            setStep(1);
            setErrorMsg("");
            const imageData = base64ToArrayBuffer(images[0]["data_url"]);
            const file = new File([imageData], images[0].file.name, { type: images[0].file.type });
            const nftstorage = new NFTStorage({ token: ipfskey })
            const { url }  = await nftstorage.store({
                image: file,
                type: images[0].file.type,
                name: tokenName,
                description,
                creator,
                format: 'none',
                attributes:attributes,
                properties:{fee:royaltyAccs}
            });
            const txResult = await createNFT(tokenName, symbol, maxSupply);
            await sleep(6000);
            const { call_result } = await getTokenAddress(txResult.transactionId);
            console.log("0x"+call_result.substring(call_result.length-40))
            const token = TokenId.fromSolidityAddress("0x"+call_result.substring(call_result.length-40));
            setMetadata(url);
            setCreatedToken(token);
            setStep(2);
        } catch (error) {
            setStep(0);
            setErrorMsg(error.message);
        }
    }

    const proceed = async () => {
        await createTokenWithJs();
        return;
        const fixedFee = [{
            amount:1,
            address: TokenId.fromString(sauceInu).toSolidityAddress(),
            useHbarsForPayment: false,
            useCurrentTokenForPayment: true,
            feeCollector: AccountId.fromString("0.0.461962").toSolidityAddress()
        }];

        const fallbackFee = new CustomFixedFee()
            .setAmount(1) 
            .setDenominatingTokenId(sauceInu)
            .setFeeCollectorAccountId("0.0.461962");
        
        const royaltyFee = new CustomRoyaltyFee()
            .setNumerator(1) 
            .setDenominator(10)
            .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(1)) // The fallback fee
            .setFeeCollectorAccountId("0.0.461962"));

        await createNFTWithFees(tokenName, symbol, maxSupply, fixedFee, royaltyAccs);
        return;
        try {
            if(step==0) {
                const createNFTTx = await createNFTFunc();
                //console.log(createdToken.toSolidityAddress().toString());
            } else if(step==2) {
                setStep(3);
                setErrorMsg("");
                const association = await associateToken(createdToken.toString());
                if(shouldApprove(quantity)) setStep(6);
                else setStep(4);
            } else if(step==4) {
                setStep(5);
                setErrorMsg("");
                const approveResult = await approveSauceInu(quantity) // need to update quantity
                setStep(6);
            } else if(step==6) {
                setStep(7);
                setErrorMsg("");
                const mintResult = await mintNFT(createdToken.toSolidityAddress().toString(), quantity, metadata) // need to update quantity
                setStep(0);
            } 
        } catch (error) {
            setErrorMsg(error.message);
            setStep(0);
        }
    }

    

    return (
        <>
            <div>
                <ImageUploading
                    value={images}
                    onChange={onChange}
                    maxNumber={10}
                    dataURLKey="data_url"
                >
                    {({
                    imageList,
                    onImageUpload,
                    onImageUpdate,
                    }) => (
                    <div className="upload__image-wrapper">
                        {imageList.length==0 && <button className='flip-button' onClick={onImageUpload}> Select NFT Image</button>}
                        {imageList.length==1 && <img className='image-upload' src={imageList[0]["data_url"]} onClick={imageList.length==0 ? onImageUpload : () => onImageUpdate(0)} alt="" width="300" />}
                    </div>
                    )}
                </ImageUploading>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='text' placeholder='Name (required)' onChange={(e) => setTokenName(e.target.value)} value={tokenName}/>
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='text' placeholder='Collection Symbol (required)' onChange={(e) => setSymbol(e.target.value)} value={symbol}/>
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='number' placeholder='Max Supply (required)' onChange={(e) => setMaxSupply(e.target.value)} value={maxSupply}/>
                </div>
                <div className='box-container'>
                    <textarea className='text-input' disabled={step!==0} type='text' placeholder='NFT Description' onChange={(e) => setDescription(e.target.value)} value={description} rows={3} />
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='text' placeholder='Creator (required)' onChange={(e) => setCreator(e.target.value)} value={creator} />
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='number' placeholder='Quantity (required)' onChange={(e) => setQuantity(e.target.value)} value={quantity}/>
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='text' placeholder='Fallback Fee' onChange={(e) => setFallbackFee(e.target.value)} value={fallbackFee}/>
                </div>
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='number' placeholder='Number of Royalty Accounts' onChange={(e) => updateNumRoyaltyAccs(e.target.value)} value={numRoyaltyAccs} />
                </div>
                {royaltyAccs.map(
                    (item, index) => (
                        <>
                    <div className='box-container'>
                        <input className='text-input' disabled={step!==0} type='text' placeholder={`Royalty Account ${index+1}`} value={item.trait_type} 
                            onChange={(e)=>updateRoyaltyAccs(index, "royalty_account", e.target.value)}
                        />
                    </div>
                    <div className='box-container'>
                        <input className='text-input' disabled={step!==0} type='text' placeholder={`Royalty Fee ${index+1}`} value={item.value} 
                            onChange={(e)=>updateRoyaltyAccs(index, "fee", e.target.value)}
                        />
                    </div>
                </>
                    )
                )}
                <div className='box-container'>
                    <input className='text-input' disabled={step!==0} type='number' placeholder='Number of Attributes' onChange={(e) => updateNumAttributes(e.target.value)} value={numAttributes}/>
                </div>
                {attributes.map(
                    (item, index) => (
                        <>
                    <div className='box-container'>
                        <input className='text-input' disabled={step!==0} type='text' placeholder={`Trait Type ${index+1}`} value={item.trait_type} 
                            onChange={(e)=>updateAttributes(index, "trait_type", e.target.value)}
                        />
                    </div>
                    <div className='box-container'>
                        <input className='text-input' disabled={step!==0} type='text' placeholder={`Value ${index+1}`} value={item.value} 
                            onChange={(e)=>updateAttributes(index, "value", e.target.value)}
                        />
                    </div>
                </>)
                )}
            </div>
            {step%2==1 && <div class="loading-spinner">
                <Oval
                    height={80}
                    width={80}
                    color="#4fa94d"
                    wrapperStyle={{}}
                    wrapperClass=""
                    visible={true}
                    ariaLabel='oval-loading'
                    secondaryColor="#4fa94d"
                    strokeWidth={2}
                    strokeWidthSecondary={2}
                />
            </div>}
            <div className='error-message' ><span>{errorMsg}</span></div>
            <div className='box-container'>
                <button className="flip-button" tabIndex="0" style={{width:"100%"}} onClick={proceed}>
                    {buttonTxt[step]}
                </button>
            </div>
        </>
    );
  }
  
  export default SingleTab;
  