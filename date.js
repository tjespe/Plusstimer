const formatDate = (...args)=>{
	const date = new Date(...args);
	const today = new Date();

	const data = [
		["getFullYear", "for {} år siden"],
		["getMonth", "for {} måned((er)) siden"],
		["getDay", "for {} dag((er)) siden"],
		["getHours", "for {} time((r)) siden"],
		["getMinutes", "for {} minutt((er)) siden"]
	].map(tuple=>({ method: tuple[0], text: tuple[1] }));

	for (let i = 0; i < data.length; i++) {
		const { method, text } = data[i];
		const diff = date[method]() - today[method]();
		if (diff !== 0) 
			return text.replace(/\{\}/g, -diff)
				.replace(/\(\((\w+)\)\)/g, (_, pluralizer)=>diff === -1 ? '' : pluralizer);
	}

	return "akkurat nå";
};