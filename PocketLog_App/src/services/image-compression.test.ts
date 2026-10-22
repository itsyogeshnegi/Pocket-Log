import { nextCompressionStep } from "./image-compression";
it("reduces dimensions and quality while respecting minimum size",()=>{expect(nextCompressionStep(2000,1600,.86,1200)).toEqual({width:1640,height:1312,quality:.74});expect(nextCompressionStep(1200,900,.4,900)).toEqual({width:1200,height:900,quality:.35})});

