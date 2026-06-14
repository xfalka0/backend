const getProfileGender = (profile) => {
    if (!profile) return '';
    let raw = (profile.gender || '').toString().trim().toLowerCase();
    raw = raw.replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
    if (raw === 'coin_bayisi') return 'coin_bayisi';
    if (raw === 'erkek' || raw === 'male' || raw === 'man') return 'erkek';
    if (raw === 'kadin' || raw === 'female' || raw === 'woman') return 'kadin';
    return '';
};

function testProfileGender() {
    console.log('--- TESTING getProfileGender ---');
    console.log('getProfileGender(null):', getProfileGender(null) === '' ? 'PASS' : 'FAIL');
    console.log('getProfileGender(undefined):', getProfileGender(undefined) === '' ? 'PASS' : 'FAIL');
    console.log('getProfileGender({}):', getProfileGender({}) === '' ? 'PASS' : 'FAIL');
    console.log("getProfileGender({ gender: 'kadın' }):", getProfileGender({ gender: 'kadın' }) === 'kadin' ? 'PASS' : 'FAIL');
    console.log("getProfileGender({ gender: 'Kadın' }):", getProfileGender({ gender: 'Kadın' }) === 'kadin' ? 'PASS' : 'FAIL');
    console.log("getProfileGender({ gender: 'kadin' }):", getProfileGender({ gender: 'kadin' }) === 'kadin' ? 'PASS' : 'FAIL');
    console.log("getProfileGender({ gender: 'erkek' }):", getProfileGender({ gender: 'erkek' }) === 'erkek' ? 'PASS' : 'FAIL');
    console.log("getProfileGender({ gender: 'male' }):", getProfileGender({ gender: 'male' }) === 'erkek' ? 'PASS' : 'FAIL');
}

testProfileGender();
